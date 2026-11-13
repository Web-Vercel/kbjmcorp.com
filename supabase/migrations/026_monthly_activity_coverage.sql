-- Whole-month coverage is separate from raw API rows. No missing row is silently rewritten.
begin;
create table public.ads_monthly_coverage_checks (
 id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references public.ads_reporting_snapshots(id),
 request_id uuid not null,prepared_by uuid not null references auth.users(id),prepared_at timestamptz not null default now(),
 kind text not null check(kind in ('activity','zero','not_active')),amount_micros numeric(18,0) not null check(amount_micros>=0),
 impressions numeric(16,0) not null check(impressions>=0),clicks numeric(16,0) not null check(clicks>=0),
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 1000),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),active_from date,
 note text not null check(char_length(btrim(note)) between 3 and 1000),unique(prepared_by,request_id),unique(id,snapshot_id)
);
create table public.ads_monthly_coverage_reviews (
 check_id uuid primary key,snapshot_id uuid not null,decision text not null check(decision in ('approved','rejected')),
 reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default now(),note text not null check(char_length(btrim(note)) between 3 and 1000),
 foreign key(check_id,snapshot_id) references public.ads_monthly_coverage_checks(id,snapshot_id)
);
create unique index one_approved_ads_month_coverage on public.ads_monthly_coverage_reviews(snapshot_id) where decision='approved';
alter table public.ads_monthly_coverage_checks enable row level security;
alter table public.ads_monthly_coverage_reviews enable row level security;
revoke all on public.ads_monthly_coverage_checks,public.ads_monthly_coverage_reviews from public,anon,authenticated;
create trigger immutable_coverage_check before update or delete on public.ads_monthly_coverage_checks for each row execute function public.lock_posted_money();
create trigger immutable_coverage_review before update or delete on public.ads_monthly_coverage_reviews for each row execute function public.lock_posted_money();
alter table public.monthly_settlement_drafts add column coverage_kind text not null default 'complete_rows';
alter table public.monthly_settlement_drafts add column coverage_check_id uuid references public.ads_monthly_coverage_checks(id);
create function public.resolve_ads_month(p_snapshot uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.ads_reporting_snapshots%rowtype;proof public.ads_monthly_coverage_checks%rowtype;n integer;amount numeric;imps numeric;clicks numeric;kind text;normalized jsonb;base jsonb;full_bounds boolean;has_counts boolean;
begin
 select * into s from public.ads_reporting_snapshots where id=p_snapshot;
 if not found or s.currency<>'CAD' or extract(day from s.since)<>1 or s.until<>(s.since+interval '1 month'-interval '1 day')::date or s.until>=(now() at time zone s.timezone)::date then return jsonb_build_object('ready',false,'valid',false,'reason','not_closed_cad_month');end if;
 if jsonb_typeof(s.report->'daily') is distinct from 'array' then return jsonb_build_object('ready',false,'valid',false,'reason','invalid_daily');end if;
 if exists(select 1 from jsonb_array_elements(s.report->'daily') d where coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or d->>'date'<s.since::text or d->>'date'>s.until::text or coalesce(d->>'spendMicros','') !~ '^[0-9]{1,18}$' or coalesce(d->>'impressions','') !~ '^[0-9]{1,16}$' or coalesce(d->>'clicks','') !~ '^[0-9]{1,16}$')
 or (select count(distinct d->>'date') from jsonb_array_elements(s.report->'daily')d)<>jsonb_array_length(s.report->'daily') then return jsonb_build_object('ready',false,'valid',false,'reason','invalid_daily');end if;
 select count(*),coalesce(sum((d->>'spendMicros')::numeric),0),coalesce(sum((d->>'impressions')::numeric),0),coalesce(sum((d->>'clicks')::numeric),0) into n,amount,imps,clicks from jsonb_array_elements(s.report->'daily')d;
 if jsonb_typeof(s.report->'missingDates') is distinct from 'array' or s.report->'missingDates' is distinct from
 (select coalesce(jsonb_agg(g.day::date::text order by g.day),'[]'::jsonb) from generate_series(s.since::timestamp,s.until::timestamp,interval '1 day')g(day) where not exists(select 1 from jsonb_array_elements(s.report->'daily')d where d->>'date'=g.day::date::text))
 then return jsonb_build_object('ready',false,'valid',false,'reason','invalid_missing_dates');end if;
 base:=jsonb_build_object('valid',true,'observed_amount_micros',amount::text,'observed_impressions',imps::text,'observed_clicks',clicks::text);
 if amount<>s.daily_spend_micros or (s.period_spend_micros is not null and amount<>s.period_spend_micros) then return base||jsonb_build_object('valid',false,'ready',false,'reason','amount_difference');end if;
 has_counts:=coalesce(s.report->>'periodImpressions','') ~ '^[0-9]{1,16}$' and coalesce(s.report->>'periodClicks','') ~ '^[0-9]{1,16}$';
 if ((s.report->>'periodImpressions' is not null or s.report->>'periodClicks' is not null) and not has_counts) then return jsonb_build_object('valid',false,'ready',false,'reason','invalid_period_metrics');end if;
 if has_counts and ((s.report->>'periodImpressions')::numeric<>imps or (s.report->>'periodClicks')::numeric<>clicks) then return base||jsonb_build_object('valid',false,'ready',false,'reason','metric_difference');end if;
 full_bounds:=coalesce(s.report->>'startBoundary','requested')='requested' and coalesce(s.report->>'endBoundary','') in ('exclusive','last_day_label_verified')
 and ((s.report#>>'{periodRange,since}'=s.since::text) or (s.report->'periodRange' is null and n=s.until-s.since+1))
 and (s.report->'periodRange' is null or s.report#>>'{periodRange,until}'=case when s.report->>'endBoundary'='exclusive' then (s.until+1)::text else s.until::text end);
 if full_bounds and s.period_spend_micros is not null and ((n=s.until-s.since+1 and s.check_status='matched') or has_counts) then kind:=case when n=s.until-s.since+1 then 'complete_rows' else 'aggregate_verified' end;
 else
  select c.* into proof from public.ads_monthly_coverage_checks c join public.ads_monthly_coverage_reviews r on r.check_id=c.id and r.decision='approved' where c.snapshot_id=s.id order by r.reviewed_at desc limit 1;
  if not found then return base||jsonb_build_object('ready',false,'reason','external_confirmation_required');end if;
  if proof.amount_micros<>amount or proof.impressions<>imps or proof.clicks<>clicks then return base||jsonb_build_object('valid',false,'ready',false,'reason','proof_difference');end if;
  kind:=case proof.kind when 'activity' then 'reviewed_activity' when 'zero' then 'reviewed_zero' else 'not_active' end;
 end if;
 select jsonb_agg(jsonb_build_object('date',g.day::date::text,'spendMicros',coalesce(d->>'spendMicros','0'),'impressions',coalesce(d->>'impressions','0'),'clicks',coalesce(d->>'clicks','0'),
 'origin',case when d is not null then 'api' when kind='aggregate_verified' then 'aggregate_zero' when kind='not_active' then 'not_active' else 'reviewed_no_activity' end) order by g.day)
 into normalized from generate_series(s.since::timestamp,s.until::timestamp,interval '1 day')g(day)
 left join lateral(select value d from jsonb_array_elements(s.report->'daily') where value->>'date'=g.day::date::text)x on true;
 return base||jsonb_build_object('ready',true,'reason','verified','coverage_kind',kind,'coverage_check_id',proof.id,'amount_micros',amount::text,'impressions',imps::text,'clicks',clicks::text,'daily',normalized);
end $$;
revoke all on function public.resolve_ads_month(uuid) from public,anon,authenticated;
create function public.submit_ads_month_coverage(p_snapshot uuid,p_request uuid,p_kind text,p_amount text,p_impressions text,p_clicks text,p_evidence text,p_hash text,p_active_from date,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.ads_reporting_snapshots%rowtype;b public.ads_reporting_bindings%rowtype;resolved jsonb;prior public.ads_monthly_coverage_checks%rowtype;result uuid;
begin
 select * into s from public.ads_reporting_snapshots where id=p_snapshot;
 select * into b from public.ads_reporting_bindings where account_id=s.account_id for share;
 if not found or not b.active or not public.has_ops_capability('finance.prepare',b.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if not exists(select 1 from public.ads_source_handoffs where snapshot_id=s.id and binding_id=b.id) then raise exception 'Source handoff required' using errcode='22023';end if;
 if p_request is null or p_kind is null or p_kind not in ('activity','zero','not_active') or coalesce(p_amount,'') !~ '^[0-9]{1,18}$' or coalesce(p_impressions,'') !~ '^[0-9]{1,16}$' or coalesce(p_clicks,'') !~ '^[0-9]{1,16}$'
 or p_evidence is null or char_length(btrim(p_evidence)) not between 3 and 1000 or coalesce(p_hash,'') !~ '^[a-f0-9]{64}$' or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Coverage evidence required' using errcode='22023';end if;
 resolved:=public.resolve_ads_month(s.id);
 if coalesce((resolved->>'valid')::boolean,false) is not true or (resolved->>'observed_amount_micros')::numeric<>p_amount::numeric or (resolved->>'observed_impressions')::numeric<>p_impressions::numeric or (resolved->>'observed_clicks')::numeric<>p_clicks::numeric then raise exception 'Source and official evidence totals must agree' using errcode='23514';end if;
 if (p_kind in ('zero','not_active') and (p_amount::numeric<>0 or p_impressions::numeric<>0 or p_clicks::numeric<>0)) or (p_kind='activity' and p_amount::numeric=0 and p_impressions::numeric=0 and p_clicks::numeric=0)
 or (p_kind='not_active' and (p_active_from is null or p_active_from<=s.until or p_active_from>(now() at time zone s.timezone)::date)) or (p_kind<>'not_active' and p_active_from is not null) then raise exception 'Coverage classification invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into prior from public.ads_monthly_coverage_checks where prepared_by=auth.uid() and request_id=p_request;
 if found then
  if prior.snapshot_id<>s.id or prior.kind<>p_kind or prior.amount_micros<>p_amount::numeric or prior.impressions<>p_impressions::numeric or prior.clicks<>p_clicks::numeric or prior.evidence_reference<>btrim(p_evidence) or prior.evidence_sha256<>p_hash or prior.active_from is distinct from p_active_from or prior.note<>btrim(p_note) then raise exception 'Coverage request changed' using errcode='40001';end if;
  return prior.id;
 end if;
 insert into public.ads_monthly_coverage_checks(snapshot_id,request_id,prepared_by,kind,amount_micros,impressions,clicks,evidence_reference,evidence_sha256,active_from,note)
 values(s.id,p_request,auth.uid(),p_kind,p_amount::numeric,p_impressions::numeric,p_clicks::numeric,btrim(p_evidence),p_hash,p_active_from,btrim(p_note)) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_month_coverage',result,'INSERT',jsonb_build_object('snapshot_id',s.id,'kind',p_kind));
 return result;
end $$;
create function public.review_ads_month_coverage(p_check uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare c public.ads_monthly_coverage_checks%rowtype;b public.ads_reporting_bindings%rowtype;prior public.ads_monthly_coverage_reviews%rowtype;
begin
 select * into c from public.ads_monthly_coverage_checks where id=p_check;
 select b1.* into b from public.ads_reporting_bindings b1 join public.ads_reporting_snapshots s on s.account_id=b1.account_id where s.id=c.snapshot_id for share of b1;
 if not found or not b.active or not public.has_ops_capability('finance.review',b.organization_id) or c.prepared_by=auth.uid() then raise exception 'Independent authorized reviewer required' using errcode='42501';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.snapshot_id::text,260026));
 select * into prior from public.ads_monthly_coverage_reviews where check_id=c.id;
 if found then if prior.decision=p_decision and prior.note=btrim(p_note) and prior.reviewed_by=auth.uid() then return;end if;raise exception 'Review changed' using errcode='40001';end if;
 if p_decision='approved' and exists(select 1 from public.ads_monthly_coverage_checks c2 join public.ads_monthly_coverage_reviews r on r.check_id=c2.id and r.decision='approved' where c2.snapshot_id=c.snapshot_id) then raise exception 'Snapshot coverage already approved' using errcode='40001';end if;
 insert into public.ads_monthly_coverage_reviews(check_id,snapshot_id,decision,reviewed_by,note) values(c.id,c.snapshot_id,p_decision,auth.uid(),btrim(p_note));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_month_coverage_review',c.id,'INSERT',jsonb_build_object('decision',p_decision));
end $$;
create function public.list_ads_month_coverage(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(x.record order by x.prepared_at desc,x.id desc) from (
 select c.id,c.prepared_at,jsonb_build_object('id',c.id,'snapshot_id',c.snapshot_id,'account_name',s.account_name,'currency',s.currency,'since',s.since,'until',s.until,'timezone',s.timezone,'kind',c.kind,'amount_micros',c.amount_micros::text,'impressions',c.impressions::text,'clicks',c.clicks::text,'evidence_reference',c.evidence_reference,'evidence_sha256',c.evidence_sha256,'active_from',c.active_from,'note',c.note,'prepared_by',c.prepared_by,'status',coalesce(r.decision,'pending'),'review_note',r.note) record
 from public.ads_monthly_coverage_checks c join public.ads_reporting_snapshots s on s.id=c.snapshot_id join public.ads_reporting_bindings b on b.account_id=s.account_id and b.active and b.organization_id=p_org
 left join public.ads_monthly_coverage_reviews r on r.check_id=c.id order by c.prepared_at desc,c.id desc limit 50)x),'[]'::jsonb);
end $$;
revoke all on function public.submit_ads_month_coverage(uuid,uuid,text,text,text,text,text,text,date,text),public.review_ads_month_coverage(uuid,text,text),public.list_ads_month_coverage(uuid) from public,anon;
grant execute on function public.submit_ads_month_coverage(uuid,uuid,text,text,text,text,text,text,date,text),public.review_ads_month_coverage(uuid,text,text),public.list_ads_month_coverage(uuid) to authenticated;

create or replace function public.prepare_monthly_settlement(p_snapshot uuid,p_quote uuid,p_agreement text,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.ads_reporting_snapshots%rowtype;b public.ads_reporting_bindings%rowtype;q public.agency_quote_snapshots%rowtype;prior public.monthly_settlement_drafts%rowtype;result uuid;cad bigint;days integer;effective jsonb;
begin
 select * into q from public.agency_quote_snapshots where id=p_quote for update;
 if not found or not public.has_ops_capability('finance.prepare',q.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_agreement is null or char_length(btrim(p_agreement)) not between 3 and 1000 or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Agreement and note required' using errcode='22023'; end if;
 select * into prior from public.monthly_settlement_drafts where quote_id=p_quote;
 if found then
  if prior.snapshot_id<>p_snapshot or prior.prepared_by<>auth.uid() or prior.agreement_reference<>btrim(p_agreement) or prior.note<>btrim(p_note) then raise exception 'Draft already exists for quote' using errcode='40001'; end if;
  return prior.id;
 end if;
 select * into s from public.ads_reporting_snapshots where id=p_snapshot;
 if not found then raise exception 'Source unavailable' using errcode='22023'; end if;
 select * into b from public.ads_reporting_bindings where account_id=s.account_id for share;
 if not found or not b.active or b.organization_id<>q.organization_id or not exists(select 1 from public.ads_source_handoffs h where h.snapshot_id=s.id and h.binding_id=b.id) then raise exception 'Source ownership or handoff invalid' using errcode='22023'; end if;
 if exists(select 1 from public.agency_quote_lifecycle where quote_id=q.id and archived) then raise exception 'Quote archived' using errcode='40001'; end if;
 if s.currency<>'CAD' or s.since<>q.period or extract(day from s.since)<>1 or s.until<>(s.since+interval '1 month'-interval '1 day')::date or s.until>=(now() at time zone s.timezone)::date then raise exception 'Closed CAD calendar month and matching quote required' using errcode='22023'; end if;
 days:=s.until-s.since+1;
 effective:=public.resolve_ads_month(s.id);
 if coalesce((effective->>'ready')::boolean,false) is not true then raise exception 'Monthly coverage incomplete or not verified' using errcode='23514';end if;
 s.check_status:='matched';s.daily_spend_micros:=(effective->>'amount_micros')::numeric;s.period_spend_micros:=s.daily_spend_micros;
 s.report:=s.report||jsonb_build_object('daily',effective->'daily','missingDates','[]'::jsonb,'endBoundary','exclusive');
 
 if s.check_status<>'matched' or s.period_spend_micros is null or s.period_spend_micros<>s.daily_spend_micros
 or s.report->'missingDates' is distinct from '[]'::jsonb
 or coalesce(s.report->>'endBoundary','') not in ('exclusive','last_day_label_verified')
 or jsonb_typeof(s.report->'daily') is distinct from 'array'
 then raise exception 'Source checks incomplete' using errcode='23514'; end if;
 if jsonb_array_length(s.report->'daily')<>days
 or (select count(distinct d->>'date') from jsonb_array_elements(s.report->'daily') d)<>days
 or exists(select 1 from jsonb_array_elements(s.report->'daily') d where coalesce(d->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or d->>'date'<s.since::text or d->>'date'>s.until::text or coalesce(d->>'spendMicros','') !~ '^[0-9]{1,18}$')
 then raise exception 'Daily coverage incomplete' using errcode='23514'; end if;
 if (select sum((d->>'spendMicros')::numeric) from jsonb_array_elements(s.report->'daily') d)<>s.daily_spend_micros then raise exception 'Daily sum mismatch' using errcode='23514'; end if;
 -- Round the complete month once, half-up, from millionths to CAD cents.
 cad:=round(s.period_spend_micros/10000,0)::bigint;
 if q.private_snapshot->>'calculationVersion' is distinct from 'two-agency-v1' or coalesce(q.private_snapshot->>'sourceCadMinor','') !~ '^[0-9]{1,10}$' or coalesce(q.private_snapshot->>'finalMinor','') !~ '^[0-9]{1,18}$' then raise exception 'Quote calculation unavailable' using errcode='22023'; end if;
 if (q.private_snapshot->>'sourceCadMinor')::bigint<>cad then raise exception 'Quote source amount differs' using errcode='22023'; end if;
 insert into public.monthly_settlement_drafts(organization_id,binding_id,snapshot_id,quote_id,month,source_cad_minor,total_cny_minor,agreement_reference,note,prepared_by,coverage_kind,coverage_check_id)
 values(q.organization_id,b.id,s.id,q.id,q.period,cad,(q.private_snapshot->>'finalMinor')::bigint,btrim(p_agreement),btrim(p_note),auth.uid(),effective->>'coverage_kind',(effective->>'coverage_check_id')::uuid) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_settlement_draft',result,'INSERT',jsonb_build_object('snapshot_id',s.id,'quote_id',q.id,'no_ledger_posting',true));
 return result;
end $$;
create or replace function public.publish_monthly_statement(p_draft uuid,p_summary text,p_expected jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.monthly_settlement_drafts%rowtype;b public.ads_reporting_bindings%rowtype;q public.agency_quote_snapshots%rowtype;s public.ads_reporting_snapshots%rowtype;w public.client_wallets%rowtype;
 prior public.monthly_client_statements%rowtype;result uuid;upstream bigint;service bigint;total bigint;balance numeric;public_usage jsonb;effective jsonb;
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
 effective:=public.resolve_ads_month(s.id);
 if coalesce((effective->>'ready')::boolean,false) is not true then raise exception 'Monthly coverage incomplete or not verified' using errcode='23514';end if;
 s.check_status:='matched';s.daily_spend_micros:=(effective->>'amount_micros')::numeric;s.period_spend_micros:=s.daily_spend_micros;
 s.report:=s.report||jsonb_build_object('daily',effective->'daily','missingDates','[]'::jsonb,'endBoundary','exclusive');
 
 if d.coverage_check_id is distinct from (effective->>'coverage_check_id')::uuid then raise exception 'Coverage proof differs from preparation' using errcode='40001';end if;
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
 select jsonb_build_object('account_name',s.account_name,'since',s.since,'until',s.until,'timezone',s.timezone,'coverage_kind',effective->>'coverage_kind',
 'impressions',sum((v->>'impressions')::numeric)::text,'clicks',sum((v->>'clicks')::numeric)::text,
 'daily',jsonb_agg(jsonb_build_object('date',v->>'date','impressions',v->>'impressions','clicks',v->>'clicks','origin',v->>'origin') order by v->>'date')) into public_usage
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
create or replace function public.list_ads_source_handoffs(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
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
 where b.organization_id=p_org and b.active
 order by h.shared_at desc,h.id desc limit 20
 ) x),'[]'::jsonb);
end $$;
notify pgrst,'reload schema';
commit;
