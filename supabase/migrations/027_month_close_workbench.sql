-- Read-only, month-scoped internal workflow overview. No source collection or money writes.
begin;
create function public.get_month_close_overview(p_org uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b record;s public.ads_reporting_snapshots%rowtype;latest_source public.ads_reporting_snapshots%rowtype;d public.monthly_settlement_drafts%rowtype;r public.monthly_settlement_reviews%rowtype;posted public.monthly_client_statements%rowtype;
 wallet public.client_wallets%rowtype;resolved jsonb;accounts jsonb:='[]'::jsonb;stage text;balance numeric:=0;pending_count integer;pending_amount numeric;quote_count integer;operational_count integer;month_end date;tz text;owner boolean;coverage_author uuid;coverage_status text;archived boolean;
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 month_end:=(p_month+interval '1 month'-interval '1 day')::date;owner:=public.has_staff_access(array['admin']::text[]);
 select * into wallet from public.client_wallets where organization_id=p_org and currency='CNY';
 select coalesce(sum(amount_minor),0) into balance from public.wallet_entries where wallet_id=wallet.id;
 select count(*),coalesce(sum(amount_minor),0) into pending_count,pending_amount from public.bank_receipts where wallet_id=wallet.id and status='pending';
 for b in select x.*,coalesce(a.label,x.account_id) account_label from public.ads_reporting_bindings x join public.ad_accounts a on a.id=x.ad_account_id where x.organization_id=p_org order by x.account_id loop
  s:=null;d:=null;r:=null;posted:=null;latest_source:=null;coverage_author:=null;coverage_status:=null;resolved:=null;quote_count:=0;archived:=false;
  select timezone into tz from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc,id desc limit 1;
  select * into posted from public.monthly_client_statements where binding_id=b.id and month=p_month;
  if posted.id is not null then select * into d from public.monthly_settlement_drafts where id=posted.draft_id;else select * into d from public.monthly_settlement_drafts where binding_id=b.id and month=p_month order by prepared_at desc,id desc limit 1;end if;
  if d.id is not null then
   select * into r from public.monthly_settlement_reviews where draft_id=d.id;
   select coalesce(l.archived,false) into archived from public.agency_quote_snapshots q left join public.agency_quote_lifecycle l on l.quote_id=q.id where q.id=d.quote_id;
   select * into s from public.ads_reporting_snapshots where id=d.snapshot_id;
  else
   select source.* into s from public.ads_reporting_snapshots source join public.ads_source_handoffs h on h.snapshot_id=source.id and h.binding_id=b.id
   where source.account_id=b.account_id and source.since=p_month and source.until=month_end order by source.created_at desc,source.id desc limit 1;
  end if;
  select source.* into latest_source from public.ads_reporting_snapshots source join public.ads_source_handoffs h on h.snapshot_id=source.id and h.binding_id=b.id
  where source.account_id=b.account_id and source.since=p_month and source.until=month_end order by source.created_at desc,source.id desc limit 1;
  select count(*) into operational_count from public.ads_reporting_snapshots source join public.ads_source_handoffs h on h.snapshot_id=source.id and h.binding_id=b.id
  where source.account_id=b.account_id and source.since<=month_end and source.until>=p_month and (source.since<>p_month or source.until<>month_end);
  if s.id is not null then
   resolved:=public.resolve_ads_month(s.id);
   select c.prepared_by,coalesce(v.decision,'pending') into coverage_author,coverage_status from public.ads_monthly_coverage_checks c left join public.ads_monthly_coverage_reviews v on v.check_id=c.id
   where c.snapshot_id=s.id order by c.prepared_at desc,c.id desc limit 1;
  end if;
  if posted.id is not null then stage:='published';
  elsif not b.active then stage:='access_paused';
  elsif tz is null then stage:='account_metadata_needed';
  elsif month_end>=(now() at time zone tz)::date then stage:='month_open';
  elsif s.id is null then
   if exists(select 1 from public.ads_reporting_snapshots source where source.account_id=b.account_id and source.since=p_month and source.until=month_end) then stage:='handoff_needed';elsif p_month<((now() at time zone tz)::date-365) then stage:='source_history_needed';else stage:='source_needed';end if;
  elsif coalesce((resolved->>'ready')::boolean,false) is not true then
   if coalesce((resolved->>'valid')::boolean,false) is not true then stage:='source_invalid';
   elsif coverage_status='pending' then stage:='coverage_review_needed';else stage:='coverage_needed';end if;
  elsif d.id is not null then
   if archived then stage:='quote_archived';
   elsif r.decision='rejected' then stage:='settlement_rejected';
   elsif r.decision is null then stage:='settlement_review_needed';
   elsif wallet.id is null then stage:='wallet_needed';
   elsif balance<d.total_cny_minor then stage:='funding_needed';else stage:='publication_ready';end if;
  else
   select count(*) into quote_count from public.agency_quote_snapshots q left join public.agency_quote_lifecycle l on l.quote_id=q.id
   where q.organization_id=p_org and q.period=p_month and not coalesce(l.archived,false)
   and case when coalesce(q.private_snapshot->>'sourceCadMinor','') ~ '^[0-9]{1,10}$' then (q.private_snapshot->>'sourceCadMinor')::numeric else null end=round((resolved->>'amount_micros')::numeric/10000,0)
   and not exists(select 1 from public.monthly_settlement_drafts used where used.quote_id=q.id);
   if quote_count=0 then stage:='quote_needed';else stage:='preparation_needed';end if;
  end if;
  accounts:=accounts||jsonb_build_array(jsonb_build_object('binding_id',b.id,'account_id',b.account_id,'account_label',b.account_label,'active',b.active,'timezone',tz,'stage',stage,
   'source_id',case when b.active then s.id end,'source_ready',case when b.active then coalesce((resolved->>'ready')::boolean,false) else false end,
   'coverage_reason',case when b.active then resolved->>'reason' end,'coverage_kind',case when b.active then resolved->>'coverage_kind' end,
   'source_cad_minor',case when b.active and coalesce((resolved->>'ready')::boolean,false) then round((resolved->>'amount_micros')::numeric/10000,0)::text end,
   'operational_source_count',case when b.active then operational_count else 0 end,'quote_match_count',quote_count,'coverage_prepared_by_me',coalesce(coverage_author=auth.uid(),false),
   'draft_id',case when b.active or posted.id is not null then d.id end,'draft_status',case when b.active or posted.id is not null then r.decision end,'draft_prepared_by_me',coalesce(d.prepared_by=auth.uid(),false),'draft_total_cny_minor',case when b.active or posted.id is not null then d.total_cny_minor::text end,
   'newer_shared_source',coalesce(d.id is not null and latest_source.id is not null and latest_source.id<>d.snapshot_id and latest_source.created_at>s.created_at,false),
   'statement_id',posted.id,'published_at',posted.published_at,'posted_total_cny_minor',posted.total_cny_minor::text));
 end loop;
 return jsonb_build_object('organization_id',p_org,'month',p_month,'accounts',accounts,'wallet_id',wallet.id,'balance_minor',balance::text,'pending_receipt_count',pending_count,'pending_receipt_minor',pending_amount::text);
end $$;
revoke all on function public.get_month_close_overview(uuid,date) from public,anon;
grant execute on function public.get_month_close_overview(uuid,date) to authenticated;

create function public.list_ads_source_handoffs(p_org uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.shared_at desc,x.id desc) from (
 select h.id,h.shared_at,jsonb_build_object('id',h.id,'snapshot_id',s.id,'organization_id',b.organization_id,
 'account_name',s.account_name,'account_id',s.account_id,'currency',s.currency,'timezone',s.timezone,'since',s.since,'until',s.until,
 'source_check',s.check_status,'daily_spend_micros',s.daily_spend_micros::text,'period_spend_micros',s.period_spend_micros::text,
 'settlement_ready',(resolved.value->>'ready')::boolean,'coverage_kind',resolved.value->>'coverage_kind','coverage_reason',resolved.value->>'reason','coverage_valid',(resolved.value->>'valid')::boolean,'effective_amount_micros',resolved.value->>'amount_micros','observed_impressions',resolved.value->>'observed_impressions','observed_clicks',resolved.value->>'observed_clicks','effective_daily',resolved.value->'daily','coverage_check_id',resolved.value->>'coverage_check_id','missing_dates',s.report->'missingDates','end_boundary',s.report->>'endBoundary',
 'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d->>'date','spend_micros',d->>'spendMicros','impressions',d->>'impressions','clicks',d->>'clicks') order by d->>'date') from jsonb_array_elements(s.report->'daily') d),'[]'::jsonb),
 'source_sha256',s.report->>'rawSha256','retrieved_at',s.created_at,'shared_at',h.shared_at,'note',h.note) record
 from public.ads_source_handoffs h join public.ads_reporting_bindings b on b.id=h.binding_id
 join public.ads_reporting_snapshots s on s.id=h.snapshot_id
 cross join lateral(select public.resolve_ads_month(s.id) value offset 0)resolved
 where b.organization_id=p_org and b.active and s.since=p_month and s.until=(p_month+interval '1 month'-interval '1 day')::date
 order by h.shared_at desc,h.id desc limit 20
 ) x),'[]'::jsonb);
end $$;

create function public.list_ads_month_coverage(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x.record order by x.prepared_at desc,x.id desc) from (
 select c.id,c.prepared_at,jsonb_build_object('id',c.id,'snapshot_id',c.snapshot_id,'account_name',s.account_name,'currency',s.currency,'since',s.since,'until',s.until,'timezone',s.timezone,'kind',c.kind,'amount_micros',c.amount_micros::text,'impressions',c.impressions::text,'clicks',c.clicks::text,'evidence_reference',c.evidence_reference,'evidence_sha256',c.evidence_sha256,'active_from',c.active_from,'note',c.note,'prepared_by',c.prepared_by,'status',coalesce(r.decision,'pending'),'review_note',r.note) record
 from public.ads_monthly_coverage_checks c join public.ads_reporting_snapshots s on s.id=c.snapshot_id join public.ads_reporting_bindings b on b.account_id=s.account_id and b.active and b.organization_id=p_org
 left join public.ads_monthly_coverage_reviews r on r.check_id=c.id where s.since=p_month and s.until=(p_month+interval '1 month'-interval '1 day')::date order by c.prepared_at desc,c.id desc limit 50)x),'[]'::jsonb);
end $$;

create function public.list_agency_quotes(p_org uuid,p_include_archived boolean,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.created_at desc,x.id desc) from (
 select s.id,s.created_at,jsonb_build_object('id',s.id,'organization_id',s.organization_id,'period',s.period,'revision',s.revision,
 'status',case when coalesce(l.archived,false) then 'archived' else 'draft' end,'state_revision',coalesce(l.revision,0),
 'parent_id',d.parent_id,'total_cny_minor',s.private_snapshot->>'finalMinor','created_at',s.created_at) record
 from public.agency_quote_snapshots s left join public.agency_quote_lifecycle l on l.quote_id=s.id left join public.agency_quote_derivations d on d.quote_id=s.id
 where s.organization_id=p_org and s.period=p_month and (coalesce(p_include_archived,false) or not coalesce(l.archived,false))
 order by s.created_at desc,s.id desc limit 20
 ) x),'[]'::jsonb);
end $$;

create function public.list_monthly_settlements(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.prepared_at desc,x.id desc) from (
 select d.id,d.prepared_at,jsonb_build_object('id',d.id,'month',d.month,'snapshot_id',d.snapshot_id,'quote_id',d.quote_id,'quote_revision',q.revision,
 'coverage_kind',d.coverage_kind,'coverage_check_id',d.coverage_check_id,'source_cad_minor',d.source_cad_minor::text,'total_cny_minor',d.total_cny_minor::text,'agreement_reference',d.agreement_reference,'note',d.note,'prepared_by',d.prepared_by,'prepared_at',d.prepared_at,
 'status',coalesce(r.decision,'pending'),'review_note',r.note,'reviewed_at',r.reviewed_at,'quote_archived',coalesce(l.archived,false)) record
 from public.monthly_settlement_drafts d join public.ads_reporting_bindings b on b.id=d.binding_id and b.active join public.agency_quote_snapshots q on q.id=d.quote_id
 left join public.monthly_settlement_reviews r on r.draft_id=d.id left join public.agency_quote_lifecycle l on l.quote_id=d.quote_id
 where d.organization_id=p_org and d.month=p_month order by d.prepared_at desc,d.id desc limit 50
 )x),'[]'::jsonb);
end $$;

create function public.list_monthly_statement_receipts(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'draft_id',draft_id,'month',month,'total_cny_minor',total_cny_minor::text,'published_at',published_at) order by published_at desc)
 from (select * from public.monthly_client_statements where organization_id=p_org and month=p_month order by published_at desc limit 50)s),'[]'::jsonb);
end $$;
revoke all on function public.list_ads_source_handoffs(uuid,date),public.list_ads_month_coverage(uuid,date),public.list_agency_quotes(uuid,boolean,date),public.list_monthly_settlements(uuid,date),public.list_monthly_statement_receipts(uuid,date) from public,anon;
grant execute on function public.list_ads_source_handoffs(uuid,date),public.list_ads_month_coverage(uuid,date),public.list_agency_quotes(uuid,boolean,date),public.list_monthly_settlements(uuid,date),public.list_monthly_statement_receipts(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
