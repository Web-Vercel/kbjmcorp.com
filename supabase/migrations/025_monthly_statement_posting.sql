-- Publish one reviewed monthly settlement and post its CNY ledger debit atomically.
-- Does not transfer bank funds, pay upstream agencies or change advertising budgets.
begin;
create table public.monthly_client_statements (
 id uuid primary key default gen_random_uuid(),draft_id uuid not null unique references public.monthly_settlement_drafts(id),
 organization_id uuid not null references public.organizations(id),binding_id uuid not null references public.ads_reporting_bindings(id),
 wallet_id uuid not null,month date not null,currency text not null default 'CNY' check(currency='CNY'),
 upstream_cny_minor bigint not null check(upstream_cny_minor between 0 and 9999999999),
 service_cny_minor bigint not null check(service_cny_minor between 0 and 9999999999),
 total_cny_minor bigint not null check(total_cny_minor between 0 and 9999999999),
 summary_zh text not null check(char_length(btrim(summary_zh)) between 3 and 2000),
 usage jsonb not null check(jsonb_typeof(usage)='object'),
 published_by uuid not null references auth.users(id),published_at timestamptz not null default now(),
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 unique(binding_id,month),check(total_cny_minor=upstream_cny_minor+service_cny_minor)
);
alter table public.monthly_client_statements enable row level security;
revoke all on public.monthly_client_statements from public,anon,authenticated;
create trigger immutable_monthly_statement before update or delete on public.monthly_client_statements for each row execute function public.lock_posted_money();
create function public.verify_monthly_statement_posting() returns trigger language plpgsql security definer set search_path='' as $$
declare upstream numeric;service numeric;n integer;
begin
 select coalesce(-sum(amount_minor) filter(where kind='ad_spend'),0),coalesce(-sum(amount_minor) filter(where kind='service_fee'),0),count(*) into upstream,service,n
 from public.wallet_entries where wallet_id=NEW.wallet_id and source_reference='monthly-statement:'||NEW.id::text;
 if upstream<>NEW.upstream_cny_minor or service<>NEW.service_cny_minor or n<>(case when NEW.upstream_cny_minor>0 then 1 else 0 end)+(case when NEW.service_cny_minor>0 then 1 else 0 end) then raise exception 'Statement ledger posting incomplete' using errcode='23514'; end if;
 return NEW;
end $$;
revoke all on function public.verify_monthly_statement_posting() from public,anon,authenticated;
create constraint trigger complete_monthly_statement_posting after insert on public.monthly_client_statements deferrable initially deferred for each row execute function public.verify_monthly_statement_posting();
create function public.get_monthly_publication_input(p_draft uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 return (select jsonb_build_object('draft_id',d.id,'quote_id',q.id,'organization_id',q.organization_id,'period',q.period,'private_snapshot',q.private_snapshot)
 from public.monthly_settlement_drafts d join public.agency_quote_snapshots q on q.id=d.quote_id where d.id=p_draft);
end $$;
create function public.publish_monthly_statement(p_draft uuid,p_summary text,p_expected jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.monthly_settlement_drafts%rowtype;b public.ads_reporting_bindings%rowtype;q public.agency_quote_snapshots%rowtype;s public.ads_reporting_snapshots%rowtype;w public.client_wallets%rowtype;
 prior public.monthly_client_statements%rowtype;result uuid;upstream bigint;service bigint;total bigint;balance numeric;public_usage jsonb;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_summary is null or char_length(btrim(p_summary)) not between 3 and 2000 or p_expected is null then raise exception 'Publication input required' using errcode='22023'; end if;
 select * into d from public.monthly_settlement_drafts where id=p_draft;
 if not found then raise exception 'Draft unavailable' using errcode='22023'; end if;
 -- All app money writers lock the wallet before recording entries.
 select * into w from public.client_wallets where organization_id=d.organization_id and currency='CNY' for update;
 if not found then raise exception 'CNY wallet required' using errcode='P0002'; end if;
 select * into d from public.monthly_settlement_drafts where id=p_draft for update;
 select * into q from public.agency_quote_snapshots where id=d.quote_id for update;
 if q.private_snapshot is distinct from p_expected then raise exception 'Quote changed' using errcode='40001'; end if;
 select * into prior from public.monthly_client_statements where draft_id=d.id;
 if found then
  if prior.summary_zh<>btrim(p_summary) then raise exception 'Published statement is immutable' using errcode='40001'; end if;
  return prior.id;
 end if;
 if not exists(select 1 from public.monthly_settlement_reviews where draft_id=d.id and decision='approved' and reviewed_by<>d.prepared_by) then raise exception 'Independent approval required' using errcode='23514'; end if;
 if exists(select 1 from public.agency_quote_lifecycle where quote_id=q.id and archived) then raise exception 'Quote archived' using errcode='40001'; end if;
 select * into b from public.ads_reporting_bindings where id=d.binding_id for share;
 if not found or not b.active or b.organization_id<>d.organization_id then raise exception 'Source access paused or changed' using errcode='40001'; end if;
 if exists(select 1 from public.monthly_client_statements where binding_id=b.id and month=d.month)
 or exists(select 1 from public.monthly_ad_reports where ad_account_id=b.ad_account_id and month=d.month and published_at is not null) then raise exception 'Account month already published' using errcode='23505'; end if;
 select * into s from public.ads_reporting_snapshots where id=d.snapshot_id;
 if s.account_id<>b.account_id or s.currency<>'CAD' or s.since<>d.month or s.until<>(s.since+interval '1 month'-interval '1 day')::date
 or s.check_status<>'matched' or s.period_spend_micros is null or s.period_spend_micros<>s.daily_spend_micros
 or s.report->'missingDates' is distinct from '[]'::jsonb or coalesce(s.report->>'endBoundary','') not in ('exclusive','last_day_label_verified')
 or not exists(select 1 from public.ads_source_handoffs where snapshot_id=s.id and binding_id=b.id) then raise exception 'Source is not ready' using errcode='23514'; end if;
 if q.organization_id<>d.organization_id or q.period<>d.month or q.private_snapshot->>'sourceCadMinor' is distinct from d.source_cad_minor::text
 or round(s.period_spend_micros/10000,0)::bigint<>d.source_cad_minor then raise exception 'Settlement source mismatch' using errcode='23514'; end if;
 if coalesce(q.private_snapshot->>'upstreamCnyMinor','') !~ '^[0-9]{1,10}$' or coalesce(q.private_snapshot->>'chinaFeeCnyMinor','') !~ '^[0-9]{1,10}$'
 or coalesce(q.private_snapshot->>'customerCostMinor','') !~ '^[0-9]{1,10}$' or coalesce(q.private_snapshot->>'finalMinor','') !~ '^[0-9]{1,10}$' then raise exception 'Quote totals invalid' using errcode='22023'; end if;
 upstream:=(q.private_snapshot->>'upstreamCnyMinor')::bigint;
 service:=(q.private_snapshot->>'chinaFeeCnyMinor')::bigint+(q.private_snapshot->>'customerCostMinor')::bigint;
 total:=(q.private_snapshot->>'finalMinor')::bigint;
 if total<>d.total_cny_minor or total<>upstream+service or total>9999999999 or service>9999999999 then raise exception 'Settlement totals invalid' using errcode='23514'; end if;
 select coalesce(sum(amount_minor),0) into balance from public.wallet_entries where wallet_id=w.id;
 if balance<total then raise exception 'Insufficient posted balance' using errcode='P0003'; end if;
 if exists(select 1 from jsonb_array_elements(s.report->'daily') v where coalesce(v->>'impressions','') !~ '^[0-9]{1,16}$' or coalesce(v->>'clicks','') !~ '^[0-9]{1,16}$') then raise exception 'Usage metrics invalid' using errcode='23514'; end if;
 -- Only public service-usage metrics are copied, never CAD cost, FX or upstream margins.
 select jsonb_build_object('account_name',s.account_name,'since',s.since,'until',s.until,'timezone',s.timezone,
 'impressions',sum((v->>'impressions')::numeric)::text,'clicks',sum((v->>'clicks')::numeric)::text,
 'daily',jsonb_agg(jsonb_build_object('date',v->>'date','impressions',v->>'impressions','clicks',v->>'clicks') order by v->>'date')) into public_usage
 from jsonb_array_elements(s.report->'daily') v;
 insert into public.monthly_client_statements(draft_id,organization_id,binding_id,wallet_id,month,upstream_cny_minor,service_cny_minor,total_cny_minor,summary_zh,usage,published_by)
 values(d.id,d.organization_id,b.id,w.id,d.month,upstream,service,total,btrim(p_summary),public_usage,auth.uid()) returning id into result;
 if upstream>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference)
 values(w.id,w.organization_id,'CNY','ad_spend',-upstream,'月度广告及执行服务 / Monthly advertising and execution','monthly-statement:'||result::text); end if;
 if service>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference)
 values(w.id,w.organization_id,'CNY','service_fee',-service,'约定运营服务及其他费用 / Agreed operating and other fees','monthly-statement:'||result::text); end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_client_statement',result,'INSERT',jsonb_build_object('draft_id',d.id,'total_cny_minor',total::text,'atomic_ledger_posting',true));
 return result;
end $$;
create function public.list_monthly_statement_receipts(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'draft_id',draft_id,'month',month,'total_cny_minor',total_cny_minor::text,'published_at',published_at) order by published_at desc)
 from (select * from public.monthly_client_statements where organization_id=p_org order by published_at desc limit 50)s),'[]'::jsonb);
end $$;
create function public.get_client_monthly_statements() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'organization_name',o.name,'month',s.month,'currency',s.currency,
 'advertising_service_minor',s.upstream_cny_minor::text,'operating_other_minor',s.service_cny_minor::text,'total_minor',s.total_cny_minor::text,
 'summary_zh',s.summary_zh,'usage',s.usage,'published_at',s.published_at) order by s.month desc,s.published_at desc),'[]'::jsonb)
 from (select * from public.monthly_client_statements where public.has_finance_access(organization_id) order by month desc,published_at desc limit 100)s
 join public.organizations o on o.id=s.organization_id;
$$;
revoke all on function public.get_monthly_publication_input(uuid),public.publish_monthly_statement(uuid,text,jsonb),public.list_monthly_statement_receipts(uuid),public.get_client_monthly_statements() from public,anon;
grant execute on function public.get_monthly_publication_input(uuid),public.publish_monthly_statement(uuid,text,jsonb),public.list_monthly_statement_receipts(uuid),public.get_client_monthly_statements() to authenticated;
notify pgrst,'reload schema';
commit;
