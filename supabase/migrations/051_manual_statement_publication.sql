-- Reviewed manual sources publish into the same immutable client statements and ledger.
-- No automatic publication, bank transfer, fabricated API snapshot or performance metrics.
begin;
alter table public.ops_source_packets drop constraint ops_source_packets_status_check;
alter table public.ops_source_packets add constraint ops_source_packets_status_check check(status in ('submitted','needs_correction','under_review','ready_for_publication','superseded','published'));
alter table public.monthly_client_statements alter column draft_id drop not null,alter column binding_id drop not null;
alter table public.monthly_client_statements add column manual_reconciliation_id uuid unique references public.ops_reconciliations(id);
alter table public.monthly_client_statements add constraint statement_source_kind check (
 (draft_id is not null and binding_id is not null and manual_reconciliation_id is null)
 or (draft_id is null and binding_id is null and manual_reconciliation_id is not null));
-- Share the account lock with manual preparation/review. Protect automatic and manual
-- publications from charging the same account/month through different source routes.
create function public.guard_statement_account_month() returns trigger language plpgsql security definer set search_path='' as $$
declare account uuid;org uuid;period date;
begin
 if NEW.manual_reconciliation_id is not null then
  select p.ad_account_id,p.organization_id,p.period into account,org,period from public.ops_reconciliations r join public.ops_source_packets p on p.id=r.packet_id where r.id=NEW.manual_reconciliation_id;
 else
  select b.ad_account_id,b.organization_id,NEW.month into account,org,period from public.ads_reporting_bindings b where b.id=NEW.binding_id;
 end if;
 if account is null or org is distinct from NEW.organization_id or period is distinct from NEW.month then raise exception 'Statement source scope mismatch' using errcode='23514';end if;
 perform 1 from public.ad_accounts where id=account for update;
 if exists(select 1 from public.monthly_ad_reports where ad_account_id=account and month=NEW.month and published_at is not null)
 or exists(select 1 from public.monthly_client_statements s left join public.ads_reporting_bindings b on b.id=s.binding_id left join public.ops_reconciliations r on r.id=s.manual_reconciliation_id left join public.ops_source_packets p on p.id=r.packet_id where s.month=NEW.month and coalesce(b.ad_account_id,p.ad_account_id)=account) then
 raise exception 'Account month already published' using errcode='23505';end if;
 return NEW;
end $$;
revoke all on function public.guard_statement_account_month() from public,anon,authenticated;
create trigger guard_statement_account_month before insert on public.monthly_client_statements for each row execute function public.guard_statement_account_month();

create function public.get_manual_publication(p_draft uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.ops_reconciliations%rowtype;p public.ops_source_packets%rowtype;w public.client_wallets%rowtype;s public.monthly_client_statements%rowtype;balance numeric;held bigint;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into r from public.ops_reconciliations where id=p_draft;
 select * into p from public.ops_source_packets where id=r.packet_id;
 if p.id is null then raise exception 'Draft unavailable' using errcode='22023';end if;
 select * into w from public.client_wallets where organization_id=p.organization_id and currency='CNY';
 select coalesce(sum(amount_minor),0) into balance from public.wallet_entries where wallet_id=w.id;
 held:=coalesce(public.refund_holds(w.id),0);
 select * into s from public.monthly_client_statements where manual_reconciliation_id=r.id;
 return jsonb_build_object('draftId',r.id,'organizationId',p.organization_id,'period',p.period,'status',r.status,'testRecord',exists(select 1 from public.organizations where id=p.organization_id and name='财务流程验收企业（虚构）'),'amountMinor',(r.ad_spend_cny_minor+r.fee_minor)::text,
 'walletOpen',w.id is not null,'balanceMinor',balance::text,'heldMinor',held::text,'availableMinor',greatest(0,balance-held)::text,'statementId',s.id);
end $$;

create function public.publish_manual_statement(p_draft uuid,p_summary text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.ops_reconciliations%rowtype;p public.ops_source_packets%rowtype;q public.billing_fx_quotes%rowtype;w public.client_wallets%rowtype;s public.monthly_client_statements%rowtype;a public.ad_accounts%rowtype;result uuid;balance numeric;total bigint;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_summary is null or char_length(btrim(p_summary)) not between 3 and 2000 then raise exception 'Publication summary required' using errcode='22023';end if;
 select * into r from public.ops_reconciliations where id=p_draft;
 select * into p from public.ops_source_packets where id=r.packet_id;
 if p.id is null then raise exception 'Draft unavailable' using errcode='22023';end if;
 -- Wallet first, as in the existing publication/refund writers; then the source account.
 select * into w from public.client_wallets where organization_id=p.organization_id and currency='CNY' for update;
 if w.id is null then raise exception 'CNY wallet required' using errcode='P0002';end if;
 select * into a from public.ad_accounts where id=p.ad_account_id for update;
 select * into r from public.ops_reconciliations where id=p_draft for update;
 select * into p from public.ops_source_packets where id=r.packet_id for share;
 select * into s from public.monthly_client_statements where manual_reconciliation_id=r.id;
 if found then
  if s.summary_zh is distinct from btrim(p_summary) then raise exception 'Published statement is immutable' using errcode='40001';end if;
  return s.id;
 end if;
 if r.status<>'approved' or r.reviewed_by is null or r.reviewed_by=r.prepared_by or p.status<>'ready_for_publication'
 or a.organization_id is distinct from p.organization_id or p.source_currency<>'CAD'
 or exists(select 1 from public.ops_source_packets where ad_account_id=p.ad_account_id and period=p.period and version>p.version) then raise exception 'Current source and independent approval required' using errcode='23514';end if;
 select * into q from public.billing_fx_quotes where id=r.fx_quote_id;
 -- Publication uses the immutable rate already independently approved, not today's new rate.
 if q.id is null or q.is_demo or q.value_date is distinct from r.settlement_date or (q.quoted_at at time zone 'Asia/Shanghai')::date is distinct from r.settlement_date
 or r.reviewed_at<q.quoted_at or (r.reviewed_at at time zone 'Asia/Shanghai')::date is distinct from r.settlement_date
 or r.ad_spend_cny_minor<>round(p.source_amount_minor::numeric*q.cad_cny_rate::numeric,0)
 or r.fee_minor<>round(r.ad_spend_cny_minor::numeric*r.fee_basis_points/10000,0)
 or (r.fee_basis_points>0 and nullif(btrim(r.fee_agreement_reference),'') is null) then raise exception 'Locked settlement amounts invalid' using errcode='23514';end if;
 total:=r.ad_spend_cny_minor+r.fee_minor;
 if total>9999999999 then raise exception 'Settlement total invalid' using errcode='22023';end if;
 select coalesce(sum(amount_minor),0) into balance from public.wallet_entries where wallet_id=w.id;
 if balance-public.refund_holds(w.id)<total then raise exception 'Insufficient available balance' using errcode='P0003';end if;
 insert into public.monthly_client_statements(manual_reconciliation_id,organization_id,wallet_id,month,upstream_cny_minor,service_cny_minor,total_cny_minor,summary_zh,usage,published_by)
 values(r.id,p.organization_id,w.id,p.period,r.ad_spend_cny_minor,r.fee_minor,total,btrim(p_summary),
 jsonb_build_object('account_name',a.label,'since',p.period,'until',(p.period+interval '1 month'-interval '1 day')::date,'timezone',p.source_timezone,'coverage_kind','manual_cost_only','impressions',null,'clicks',null,'daily','[]'::jsonb),auth.uid()) returning id into result;
 update public.ops_source_packets set status='published' where id=p.id;
 if r.ad_spend_cny_minor>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(w.id,w.organization_id,'CNY','ad_spend',-r.ad_spend_cny_minor,'月度广告及执行服务 / Monthly advertising and execution','monthly-statement:'||result::text);end if;
 if r.fee_minor>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(w.id,w.organization_id,'CNY','service_fee',-r.fee_minor,'约定运营服务及其他费用 / Agreed operating and other fees','monthly-statement:'||result::text);end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_client_statement',result,'INSERT',jsonb_build_object('manual_reconciliation_id',r.id,'source_packet_id',p.id,'total_cny_minor',total::text,'atomic_ledger_posting',true));
 return result;
end $$;
revoke all on function public.get_manual_publication(uuid),public.publish_manual_statement(uuid,text) from public,anon;
grant execute on function public.get_manual_publication(uuid),public.publish_manual_statement(uuid,text) to authenticated;

create function public.list_manual_statement_receipts(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(array_length(p_ids,1),0)>100 then raise exception 'Too many drafts' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('draft_id',s.manual_reconciliation_id,'id',s.id,'total_cny_minor',s.total_cny_minor::text)) from public.monthly_client_statements s where s.manual_reconciliation_id=any(p_ids) and public.has_ops_capability('finance.read',s.organization_id)),'[]'::jsonb);
end $$;
revoke all on function public.list_manual_statement_receipts(uuid[]) from public,anon;
grant execute on function public.list_manual_statement_receipts(uuid[]) to authenticated;
-- Approved manual costs remain committed when computing refundable funds.
create or replace function public.refund_committed(p_wallet uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce((select sum(d.total_cny_minor) from public.monthly_settlement_drafts d join public.client_wallets w on w.organization_id=d.organization_id and w.id=p_wallet join public.ads_reporting_bindings binding on binding.id=d.binding_id
 where exists(select 1 from public.monthly_settlement_reviews review where review.draft_id=d.id and review.decision='approved')
 and not exists(select 1 from public.agency_quote_lifecycle lifecycle where lifecycle.quote_id=d.quote_id and lifecycle.archived)
 and not exists(select 1 from public.monthly_client_statements s left join public.ads_reporting_bindings b on b.id=s.binding_id left join public.ops_reconciliations sr on sr.id=s.manual_reconciliation_id left join public.ops_source_packets sp on sp.id=sr.packet_id where s.month=d.month and coalesce(b.ad_account_id,sp.ad_account_id)=binding.ad_account_id)),0)::bigint+coalesce((select sum(r.ad_spend_cny_minor+r.fee_minor) from public.ops_reconciliations r join public.ops_source_packets p on p.id=r.packet_id join public.client_wallets w on w.organization_id=p.organization_id and w.id=p_wallet
 where r.status='approved' and p.status='ready_for_publication'
 and not exists(select 1 from public.ops_source_packets newer where newer.ad_account_id=p.ad_account_id and newer.period=p.period and newer.version>p.version)
 and not exists(select 1 from public.monthly_client_statements s left join public.ads_reporting_bindings b on b.id=s.binding_id left join public.ops_reconciliations sr on sr.id=s.manual_reconciliation_id left join public.ops_source_packets sp on sp.id=sr.packet_id where s.month=p.period and coalesce(b.ad_account_id,sp.ad_account_id)=p.ad_account_id)),0)::bigint
$$;
revoke all on function public.refund_committed(uuid) from public,anon,authenticated;

-- Keep manual procurement in the existing receipt allocation/reversal workflow.
alter function public.upstream_statement_amount(uuid) rename to upstream_automatic_statement_amount;
create function public.upstream_statement_amount(p_statement uuid) returns bigint language plpgsql stable security definer set search_path='' as $$
declare amount bigint;
begin
 select p.source_amount_minor into amount from public.monthly_client_statements s join public.ops_reconciliations r on r.id=s.manual_reconciliation_id join public.ops_source_packets p on p.id=r.packet_id where s.id=p_statement;
 if found then return amount;end if;
 return public.upstream_automatic_statement_amount(p_statement);
end $$;
revoke all on function public.upstream_statement_amount(uuid),public.upstream_automatic_statement_amount(uuid) from public,anon,authenticated;
-- Extend procurement totals without fabricating an automatic quote snapshot.
alter function public.get_upstream_reconciliation(date,uuid) rename to get_automatic_upstream_reconciliation;
create function public.get_upstream_reconciliation(p_month date,p_org uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;manual jsonb;totals jsonb;combined jsonb;cnt bigint;k text;
begin
 result:=public.get_automatic_upstream_reconciliation(p_month,p_org);
 select coalesce(jsonb_agg(jsonb_build_object('statement_id',s.id,'organization_id',s.organization_id,'organization_name',o.name,'month',s.month,'published_at',s.published_at,'account_name',s.usage->>'account_name',
 'quote_id',null,'quote_revision',null,'source_kind','manual','source_reference',p.source_reference,'source_revision',p.version,'draft_revision',r.revision,
 'source_cad_minor',p.source_amount_minor::text,'canada_fee_cad_minor','0','procurement_cad_minor',p.source_amount_minor::text,'procurement_cny_minor',s.upstream_cny_minor::text,'china_fee_cny_minor',s.service_cny_minor::text,'customer_transfer_cny_minor','0','agency_transfer_cny_minor','0','customer_charged_cny_minor',s.total_cny_minor::text)),'[]'::jsonb)
 into manual from public.monthly_client_statements s join public.ops_reconciliations r on r.id=s.manual_reconciliation_id join public.ops_source_packets p on p.id=r.packet_id join public.organizations o on o.id=s.organization_id where s.month=p_month and (p_org is null or s.organization_id=p_org);
 totals:=result->'totals';
 for k in select jsonb_object_keys(totals) loop
 totals:=jsonb_set(totals,array[k],to_jsonb(((totals->>k)::numeric+coalesce((select sum((v->>k)::numeric) from jsonb_array_elements(manual)v),0))::text));end loop;
 cnt:=(result->>'row_count')::bigint+jsonb_array_length(manual);
 select coalesce(jsonb_agg(v order by v->>'published_at' desc,v->>'statement_id' desc),'[]'::jsonb) into combined from (select v from jsonb_array_elements((result->'rows')||manual)v order by v->>'published_at' desc,v->>'statement_id' desc limit 200)x;
 return result||jsonb_build_object('row_count',cnt,'truncated',cnt>200,'totals',totals,'rows',combined);
end $$;
revoke all on function public.get_automatic_upstream_reconciliation(date,uuid),public.get_upstream_reconciliation(date,uuid) from public,anon;
grant execute on function public.get_upstream_reconciliation(date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
