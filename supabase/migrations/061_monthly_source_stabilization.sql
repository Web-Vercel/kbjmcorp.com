-- Preview: delayed repeated source verification; no account/global activation.
begin;
alter table public.monthly_automation_jobs add column verified_fingerprint text;
create table public.monthly_source_observations(id bigint generated always as identity primary key,job_id uuid not null references public.monthly_automation_jobs(id),fingerprint text not null,observed_at timestamptz not null default clock_timestamp(),raw_sha256 text not null,report jsonb not null);
create index monthly_source_observations_job on public.monthly_source_observations(job_id,id desc);
alter table public.monthly_source_observations enable row level security;
revoke all on public.monthly_source_observations from public,anon,authenticated,service_role;
create trigger immutable_monthly_observation before update or delete on public.monthly_source_observations for each row execute function public.lock_posted_money();
create function public.monthly_source_fingerprint(p jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object('account',p->'account','since',p->'since','until',p->'until','check',p->'check','dailySpendMicros',p->'dailySpendMicros','periodSpendMicros',p->'periodSpendMicros','missingDates',p->'missingDates','startBoundary',p->'startBoundary','endBoundary',p->'endBoundary','daily',(select jsonb_agg(jsonb_build_object('date',x->>'date','spendMicros',x->>'spendMicros','impressions',x->>'impressions','clicks',x->>'clicks') order by x->>'date') from jsonb_array_elements(p->'daily')x))::text,'UTF8')),'hex')
$$;
create function public.monthly_source_rows_valid(p jsonb,p_month date) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p->'daily')='array' and coalesce(p->>'periodSpendMicros','') ~ '^[0-9]{1,30}$' and (select count(*)=extract(day from (p_month+interval '1 month'-interval '1 day')) and count(distinct x->>'date')=count(*) and bool_and((x->>'date')::date>=p_month and (x->>'date')::date<(p_month+interval '1 month')::date and coalesce(x->>'spendMicros','') ~ '^[0-9]{1,30}$') and sum((x->>'spendMicros')::numeric)=(p->>'periodSpendMicros')::numeric from jsonb_array_elements(p->'daily')x),false)
$$;
create function public.observe_monthly_source(p_job uuid,p_lease uuid,p_report jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;b public.ads_reporting_bindings%rowtype;last public.monthly_source_observations%rowtype;fp text;n integer;closed_at timestamptz;
begin
 select * into j from public.monthly_automation_jobs where id=p_job for update;
 if j.id is null or j.state<>'running' or j.lease_token is distinct from p_lease or j.lease_until<=now() then raise exception 'Lease expired' using errcode='40001';end if;
 select * into b from public.ads_reporting_bindings where id=j.binding_id;
 closed_at:=((j.month+interval '1 month')::timestamp at time zone (p_report#>>'{account,timezone}'));
 if not public.monthly_source_rows_valid(p_report,j.month) or closed_at is null or now()<closed_at+interval '6 hours' or p_report#>>'{account,id}' is distinct from b.account_id or p_report#>>'{account,currency_code}' is distinct from 'CAD'
 or p_report->>'since' is distinct from j.month::text or p_report->>'until' is distinct from (j.month+interval '1 month'-interval '1 day')::date::text
 or p_report->>'check' is distinct from 'matched' or p_report->>'dailySpendMicros' is distinct from p_report->>'periodSpendMicros' or nullif(p_report->>'periodSpendMicros','') is null
 or p_report->'missingDates' is distinct from '[]'::jsonb or jsonb_typeof(p_report->'daily') is distinct from 'array' or jsonb_array_length(p_report->'daily')=0 or coalesce(p_report->>'rawSha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Complete closed source required' using errcode='22023';end if;
 fp:=public.monthly_source_fingerprint(p_report);
 select * into last from public.monthly_source_observations where job_id=j.id order by id desc limit 1;
 if last.id is not null and clock_timestamp()<last.observed_at+interval '12 hours' then
 update public.monthly_automation_jobs set state='retry',attempts=0,available_at=last.observed_at+interval '12 hours',error_code='source_stabilizing',lease_token=null,lease_until=null where id=j.id;
 return jsonb_build_object('state','awaiting_source','jobId',j.id);end if;
 insert into public.monthly_source_observations(job_id,fingerprint,raw_sha256,report) values(j.id,fp,p_report->>'rawSha256',p_report);
 if last.fingerprint=fp and last.observed_at<=clock_timestamp()-interval '12 hours' then
 update public.monthly_automation_jobs set verified_fingerprint=fp,error_code=null where id=j.id;
 return jsonb_build_object('state','stable','jobId',j.id);end if;
 select count(*) into n from public.monthly_source_observations where job_id=j.id;
 update public.monthly_automation_jobs set state=case when n>=5 then 'failed' else 'retry' end,attempts=case when n>=5 then 5 else 0 end,available_at=clock_timestamp()+interval '12 hours',error_code=case when n>=5 then 'source_not_stable' else 'source_stabilizing' end,verified_fingerprint=null,lease_token=null,lease_until=null,updated_at=now() where id=j.id;
 return jsonb_build_object('state',case when n>=5 then 'manual_required' else 'awaiting_source' end,'jobId',j.id,'reason',case when n>=5 then 'source_not_stable' else 'source_stabilizing' end);
end $$;
alter function public.complete_monthly_automation(uuid,uuid,jsonb,jsonb) rename to complete_monthly_automation_verified_core;
revoke all on function public.complete_monthly_automation_verified_core(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.complete_monthly_automation(p_job uuid,p_lease uuid,p_report jsonb,p_snapshot jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;
begin
 select * into j from public.monthly_automation_jobs where id=p_job for update;
 if j.verified_fingerprint is null or j.verified_fingerprint is distinct from public.monthly_source_fingerprint(p_report) then raise exception 'Repeated source verification required' using errcode='23514';end if;
 return public.complete_monthly_automation_verified_core(p_job,p_lease,p_report,p_snapshot);
end $$;
create table public.monthly_statement_rechecks(statement_id uuid primary key references public.monthly_client_statements(id),checked_at timestamptz,lease_token uuid,lease_until timestamptz,error_code text);
create table public.monthly_statement_differences(id uuid primary key default gen_random_uuid(),statement_id uuid not null references public.monthly_client_statements(id),fingerprint text not null,original_micros numeric not null,observed_micros numeric not null,report jsonb not null,created_at timestamptz not null default clock_timestamp(),unique(statement_id,fingerprint));
alter table public.monthly_statement_rechecks enable row level security;
alter table public.monthly_statement_differences enable row level security;
revoke all on public.monthly_statement_rechecks,public.monthly_statement_differences from public,anon,authenticated,service_role;
create trigger immutable_statement_difference before update or delete on public.monthly_statement_differences for each row execute function public.lock_posted_money();
create function public.claim_statement_recheck(p_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.monthly_client_statements%rowtype;b public.ads_reporting_bindings%rowtype;t uuid:=gen_random_uuid();r uuid;
begin
 select * into b from public.ads_reporting_bindings where account_id=p_account and active;
 if b.id is null then return null;end if;
 insert into public.monthly_statement_rechecks(statement_id) select id from public.monthly_client_statements where binding_id=b.id and publication_mode='automatic_rules' and published_at>=now()-interval '90 days' on conflict do nothing;
 select x.statement_id into r from public.monthly_statement_rechecks x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=b.id and (x.checked_at is null or x.checked_at<=now()-interval '24 hours') and (x.lease_until is null or x.lease_until<=now()) and y.published_at>=now()-interval '90 days' order by x.checked_at nulls first,y.month for update of x skip locked limit 1;
 if r is null then return null;end if;
 update public.monthly_statement_rechecks set lease_token=t,lease_until=now()+interval '5 minutes' where statement_id=r;
 select * into s from public.monthly_client_statements where id=r;
 return jsonb_build_object('statementId',r,'accountId',b.account_id,'month',to_char(s.month,'YYYY-MM'),'leaseToken',t);
end $$;
create function public.record_statement_recheck(p_statement uuid,p_lease uuid,p_report jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.monthly_client_statements%rowtype;d public.monthly_settlement_drafts%rowtype;old public.ads_reporting_snapshots%rowtype;r public.monthly_statement_rechecks%rowtype;fp text;amount numeric;
begin
 select * into s from public.monthly_client_statements where id=p_statement;
 perform 1 from public.client_wallets where id=s.wallet_id for update;
 select * into r from public.monthly_statement_rechecks where statement_id=p_statement for update;
 if r.statement_id is null or r.lease_token is distinct from p_lease or r.lease_until<=now() then raise exception 'Lease expired' using errcode='40001';end if;
 if p_report is null then update public.monthly_statement_rechecks set checked_at=now(),error_code='source_unavailable',lease_token=null,lease_until=null where statement_id=p_statement;return jsonb_build_object('state','unconfirmed');end if;
 select * into d from public.monthly_settlement_drafts where id=s.draft_id;
 select * into old from public.ads_reporting_snapshots where id=d.snapshot_id;
 if not public.monthly_source_rows_valid(p_report,s.month) or p_report#>>'{account,id}' is distinct from old.account_id or p_report#>>'{account,currency_code}' is distinct from old.currency or p_report#>>'{account,timezone}' is distinct from old.timezone or p_report->>'since' is distinct from old.since::text or p_report->>'until' is distinct from old.until::text or p_report->>'check' is distinct from 'matched' or p_report->>'dailySpendMicros' is distinct from p_report->>'periodSpendMicros' or nullif(p_report->>'periodSpendMicros','') is null or p_report->'missingDates' is distinct from '[]'::jsonb then raise exception 'Complete same-period source required' using errcode='22023';end if;
 fp:=public.monthly_source_fingerprint(p_report);amount:=(p_report->>'periodSpendMicros')::numeric;
 update public.monthly_statement_rechecks set checked_at=now(),error_code=null,lease_token=null,lease_until=null where statement_id=p_statement;
 if fp is distinct from public.monthly_source_fingerprint(old.report) then
 insert into public.monthly_statement_differences(statement_id,fingerprint,original_micros,observed_micros,report) values(p_statement,fp,old.period_spend_micros,amount,p_report) on conflict do nothing;
 return jsonb_build_object('state','manual_required','statementId',s.id,'reason','posted_source_changed');end if;
 return jsonb_build_object('state','idle');
end $$;
create function public.get_monthly_verification_state(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('monitoring',(select coalesce(jsonb_agg(t),'[]') from (select x.checked_at,x.error_code from public.monthly_statement_rechecks x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=p_binding order by x.checked_at desc nulls last limit 3)t),'jobs',(select coalesce(jsonb_agg(t),'[]') from (select j.id,j.month,j.state,j.error_code,j.available_at,(select count(*) from public.monthly_source_observations o where o.job_id=j.id)::integer as reads from public.monthly_automation_jobs j where binding_id=p_binding order by month desc limit 3)t),'differences',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.statement_id,s.month,x.original_micros::text,x.observed_micros::text,x.created_at from public.monthly_statement_differences x join public.monthly_client_statements s on s.id=x.statement_id where s.binding_id=p_binding order by x.created_at desc limit 20)t));
end $$;
create or replace function public.claim_monthly_automation(p_account text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.monthly_automation_jobs%rowtype;bound public.ads_reporting_bindings%rowtype;token uuid:=gen_random_uuid();r jsonb;
begin
 -- Grants, rather than forged staff JWTs, authorize the worker.
 insert into public.monthly_automation_jobs(binding_id,month,settings_revision,agreement,authorized_by)
 select b.id,date_trunc('month',now() at time zone s.timezone)::date-interval '1 month',c.revision,c.agreement,c.authorized_by
 from public.monthly_automation_settings c join public.ads_reporting_bindings b on b.id=c.binding_id
 join public.staff_members a on a.user_id=c.authorized_by and a.active and a.role='admin'
 join lateral(select timezone from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc limit 1)s on true
 where c.enabled and b.active and b.account_id=p_account and now()>=(date_trunc('month',now() at time zone s.timezone) at time zone s.timezone)+interval '6 hours' and (c.first_month is null or (date_trunc('month',now() at time zone s.timezone)::date-interval '1 month')::date>=c.first_month) on conflict(binding_id,month) do update set state='pending',settings_revision=excluded.settings_revision,agreement=excluded.agreement,authorized_by=excluded.authorized_by,attempts=0,available_at=now(),error_code=null where public.monthly_automation_jobs.state='cancelled';
 update public.monthly_automation_jobs set state='failed',error_code='attempts_exhausted',lease_token=null,lease_until=null where state='running' and lease_until<now() and attempts>=5;
 select q.* into j from public.monthly_automation_jobs q join public.monthly_automation_settings c on c.binding_id=q.binding_id and c.enabled and c.revision=q.settings_revision
 join public.ads_reporting_bindings b on b.id=q.binding_id and b.active and b.account_id=p_account
 join public.staff_members a on a.user_id=q.authorized_by and a.active and a.role='admin'
 where (c.first_month is null or q.month>=c.first_month) and q.attempts<5 and q.available_at<=now() and (q.state in ('pending','retry') or (q.state='running' and q.lease_until<now()))
 order by q.month,q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.monthly_automation_jobs set state='running',attempts=attempts+1,lease_token=token,lease_until=now()+interval '5 minutes',updated_at=now() where id=j.id;
 select * into bound from public.ads_reporting_bindings where id=j.binding_id;
 select jsonb_build_object('id',j.id,'bindingId',bound.id,'organizationId',bound.organization_id,'accountId',bound.account_id,'month',to_char(j.month,'YYYY-MM'),'agreement',j.agreement,'leaseToken',token,
 'systemRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id is null and effective_month<=j.month order by effective_month desc,revision desc limit 1)x),
 'customerRate',(select to_jsonb(x) from (select revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps from public.monthly_pricing_rates where organization_id=bound.organization_id and effective_month<=j.month order by effective_month desc,revision desc limit 1)x)) into r;
 return r;
end $$;
create or replace function public.release_automatic_month(p_account text,p_test_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.ads_reporting_bindings%rowtype;p public.monthly_auto_release_policies%rowtype;c public.monthly_automation_settings%rowtype;
 j public.monthly_automation_jobs%rowtype;d public.monthly_settlement_drafts%rowtype;q public.agency_quote_snapshots%rowtype;s public.ads_reporting_snapshots%rowtype;
 w public.client_wallets%rowtype;r uuid;statement uuid;reason text:='storage_error';proof jsonb:='[]'::jsonb;expected jsonb;ref jsonb;effective jsonb;
 cad bigint;ca bigint;upcad bigint;adcny bigint;upcny bigint;cn bigint;cost bigint;total bigint;previous bigint;available numeric;rate numeric;end_date date;key text;
begin
 select * into b from public.ads_reporting_bindings where account_id=p_account;
 if b.id is null then return jsonb_build_object('state','idle');end if;
 select * into p from public.monthly_auto_release_policies where binding_id=b.id;
 if p.binding_id is null or not p.enabled then return jsonb_build_object('state','disabled');end if;
 select * into j from public.monthly_automation_jobs x where x.binding_id=b.id and x.state='prepared' and not exists(select 1 from public.monthly_auto_release_runs v where v.job_id=x.id) order by x.month,x.created_at limit 1;
 if j.id is null then return jsonb_build_object('state','idle');end if;
 -- Wallet first, then binding/settings/policy: manual publication and refunds use the same money lock.
 select * into w from public.client_wallets where organization_id=b.organization_id and currency='CNY' for update;
 perform 1 from public.ads_reporting_bindings where id=b.id for share;
 select * into b from public.ads_reporting_bindings where id=b.id;
 select * into c from public.monthly_automation_settings where binding_id=b.id for share;
 select * into p from public.monthly_auto_release_policies where binding_id=b.id for share;
 select * into j from public.monthly_automation_jobs where id=j.id for update;
 if exists(select 1 from public.monthly_auto_release_runs where job_id=j.id) then return jsonb_build_object('state','idle');end if;
 begin
  reason:='authorization_changed';
  if b.id is null or c.binding_id is null or p.binding_id is null or not b.active or not c.enabled or not p.enabled or c.first_month is distinct from p.first_month or c.revision<>p.settings_revision or j.settings_revision<>c.revision or j.state<>'prepared'
   or j.created_at<p.authorized_at or j.month<p.first_month
   or not exists(select 1 from public.staff_members where user_id=p.authorized_by and active and role='admin')
   or not exists(select 1 from public.staff_members where user_id=j.authorized_by and active and role='admin') then raise exception 'Release blocked';end if;
  reason:='test_scope';
  if p_test_org is not null and (b.organization_id<>p_test_org or not exists(select 1 from public.organizations where id=p_test_org and name='财务流程验收企业（虚构）')) then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('authorization');
  select * into d from public.monthly_settlement_drafts where id=j.draft_id for update;
  select * into q from public.agency_quote_snapshots where id=d.quote_id for update;
  select * into s from public.ads_reporting_snapshots where id=d.snapshot_id;
  reason:='scope_or_source';end_date:=(j.month+interval '1 month'-interval '1 day')::date;
  if d.id is null or d.binding_id<>b.id or d.organization_id<>b.organization_id or d.month<>j.month or d.quote_id<>j.quote_id or d.snapshot_id<>j.source_id
   or q.organization_id<>b.organization_id or q.period<>j.month or q.id is null or s.id is null or s.timezone is null or s.account_id<>p_account or s.currency<>'CAD' or s.since<>j.month or s.until<>end_date
   or end_date>=(now() at time zone s.timezone)::date
   or q.private_snapshot#>>'{automation,sourceId}' is distinct from s.id::text or q.private_snapshot#>>'{automation,bindingId}' is distinct from b.id::text
   or q.private_snapshot#>>'{automation,agreement}' is distinct from j.agreement then raise exception 'Release blocked';end if;
  effective:=public.resolve_ads_month(s.id);
  if effective->>'ready' is distinct from 'true' or coalesce(effective->>'coverage_kind','') not in ('complete_rows','aggregate_verified')
   or s.check_status<>'matched' or s.period_spend_micros is null or s.period_spend_micros<>s.daily_spend_micros
   or exists(select 1 from public.ads_reporting_snapshots newer where newer.account_id=p_account and newer.since=j.month and newer.until=end_date and newer.id<>s.id and newer.created_at>=s.created_at) then raise exception 'Release blocked';end if;
  reason:='source_verification_required';
  if j.verified_fingerprint is null or j.verified_fingerprint is distinct from public.monthly_source_fingerprint(s.report) then raise exception 'Release blocked';end if;
  reason:='posted_source_changed';
  if exists(select 1 from public.monthly_statement_differences x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=b.id) then raise exception 'Release blocked';end if;
  reason:='reference_invalid';ref:=q.private_snapshot->'referenceProof';
  if coalesce(ref->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or nullif(ref->>'fetchedAt','') is null or ref->>'source' is distinct from 'Bank of Canada' or ref->>'series' is distinct from 'FXCNYCAD' or ref->>'policy' is distinct from 'month_end_last_published'
   or ref->>'billingMonth' is distinct from to_char(j.month,'YYYY-MM') or ref->>'rate' is distinct from q.private_snapshot->>'rate'
   or ref->>'date' is distinct from q.private_snapshot->>'referenceDate' or ref->>'sourceUrl' is distinct from ('https://www.bankofcanada.ca/valet/observations/FXCNYCAD/json?start_date='||j.month::text||'&end_date='||end_date::text)
   or ((ref->>'fetchedAt')::timestamptz at time zone 'America/Toronto')::date<=end_date or (ref->>'date')::date<j.month or (ref->>'date')::date>end_date or end_date-(ref->>'date')::date>7
   or coalesce(ref->>'rate','') !~ '^[0-9]{1,4}\.[0-9]{8}$' or (ref->>'rate')::numeric<=0
   or coalesce(ref->>'originalCnyCad','') !~ '^[0-9]{1,4}(\.[0-9]{1,12})?$' or (ref->>'originalCnyCad')::numeric<=0
   or round(1/(ref->>'originalCnyCad')::numeric,8)<>(ref->>'rate')::numeric or (ref->>'fetchedAt')::timestamptz>now()+interval '5 minutes' then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('source_and_reference');
  reason:='rates_changed';
  lock table public.monthly_pricing_rates in share mode;
  expected:=public.auto_release_effective_rates(b.organization_id,j.month);
  if (expected->>'canada_bps')::integer is distinct from p.canada_bps or (expected->>'china_bps')::integer is distinct from p.china_bps or (expected->>'transfer_bps')::integer is distinct from p.transfer_bps then raise exception 'Release blocked';end if;
  reason:='rules_or_calculation';rate:=(ref->>'rate')::numeric;cad:=round(s.period_spend_micros/10000,0)::bigint;
  if q.private_snapshot->>'calculationVersion' is distinct from 'two-agency-v1' or q.private_snapshot->>'rateMode' is distinct from 'automatic'
   or q.private_snapshot->'canadaRule' is distinct from jsonb_build_object('mode','percentage','basis','platform_ad_spend','basisPoints',p.canada_bps,'fixedMinor','0','minimumMinor','0','waiveWhenZero',true)
   or q.private_snapshot->'chinaRule' is distinct from jsonb_build_object('mode','percentage','basis','upstream_total','basisPoints',p.china_bps,'fixedMinor','0','minimumMinor','0','waiveWhenZero',true)
   or q.private_snapshot->'transferRule' is distinct from jsonb_build_object('mode','markup','basisPoints',p.transfer_bps,'fixedMinor','0','bearer','customer','includedInRate',false) then raise exception 'Release blocked';end if;
  ca:=round(cad::numeric*p.canada_bps/10000,0)::bigint;upcad:=cad+ca;adcny:=round(cad*rate,0)::bigint;upcny:=round(upcad*rate,0)::bigint;
  cn:=round(upcny::numeric*p.china_bps/10000,0)::bigint;cost:=round(upcny::numeric*p.transfer_bps/10000,0)::bigint;total:=upcny+cn+cost;
  expected:=jsonb_build_object('sourceCadMinor',cad::text,'canadaFeeCadMinor',ca::text,'upstreamCadMinor',upcad::text,'adCnyMinor',adcny::text,'canadaFeeCnyMinor',(upcny-adcny)::text,'upstreamCnyMinor',upcny::text,'chinaFeeCnyMinor',cn::text,'totalCnyMinor',(upcny+cn)::text,'costMinor',cost::text,'customerCostMinor',cost::text,'agencyCostMinor','0','finalMinor',total::text);
  for key in select jsonb_object_keys(expected) loop if q.private_snapshot->key is distinct from expected->key then raise exception 'Release blocked';end if;end loop;
  if d.source_cad_minor<>cad or d.total_cny_minor<>total then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('approved_rules_and_recalculation');
  reason:='conflict_or_dispute';
  if exists(select 1 from public.monthly_settlement_reviews where draft_id=d.id)
   or exists(select 1 from public.agency_quote_lifecycle where quote_id=q.id and archived)
   or exists(select 1 from public.monthly_settlement_drafts where binding_id=b.id and month=d.month and id<>d.id)
   or exists(select 1 from public.service_requests where organization_id=b.organization_id and (category='billing' or statement_id is not null) and status<>'resolved')
   or exists(select 1 from public.monthly_client_statements where binding_id=b.id and month=d.month)
   or exists(select 1 from public.monthly_ad_reports where ad_account_id=b.ad_account_id and month=d.month and published_at is not null) then raise exception 'Release blocked';end if;
  reason:='earlier_month_unsettled';
  if exists(select 1 from (select p.first_month as period union select (x.month+interval '1 month')::date from public.monthly_client_statements x where x.binding_id=b.id and x.month>=p.first_month) candidate where candidate.period<j.month and not exists(select 1 from public.monthly_client_statements x where x.binding_id=b.id and x.month=candidate.period)) then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('no_conflict_dispute_or_gap');
  reason:='amount_limit';
  if p.max_minor is not null and total>p.max_minor then raise exception 'Release blocked';end if;
  select total_cny_minor into previous from public.monthly_client_statements where binding_id=b.id and month<j.month order by month desc limit 1;
  if p.max_growth_bps is not null and previous is not null and ((previous=0 and total>0) or (previous>0 and abs(total-previous)::numeric*10000>previous::numeric*p.max_growth_bps)) then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('amount_limits');
  reason:='insufficient_available_balance';
  if w.id is null then raise exception 'Release blocked';end if;
  available:=public.refund_available(w.id);
  if available<total then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('available_prepaid_balance');
  insert into public.monthly_auto_release_runs(job_id,binding_id,draft_id,policy_revision,state,proof)
  values(j.id,b.id,d.id,p.revision,'passed',jsonb_build_object('version','automatic-release-v1','checks',proof,'source_id',s.id,'source_sha256',s.report->>'rawSha256','quote_id',q.id,'policy',to_jsonb(p),'calculated',expected,'reference',ref)) returning id into r;
  reason:='publication_conflict';
  statement:=public.post_monthly_statement_internal(d.id,
   (case when p_test_org is not null then '[ACCEPTANCE-TEST-NOT-PAYABLE] ' else '' end)||to_char(j.month,'YYYY-MM')||' 广告投放及执行服务、综合服务费。',q.private_snapshot,r);
  set constraints public.complete_monthly_statement_posting immediate;
  return jsonb_build_object('state','published','jobId',j.id,'draftId',d.id,'statementId',statement);
 exception when others then
  -- This subtransaction rolls back any partial statement, debit and passed proof before recording the exception.
  insert into public.monthly_auto_release_runs(job_id,binding_id,draft_id,policy_revision,state,reason,proof)
  values(j.id,b.id,j.draft_id,p.revision,'blocked',reason,jsonb_build_object('version','automatic-release-v1','completed_checks',proof,'no_publication',true,'no_debit',true)) on conflict(job_id) do nothing;
  insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(null,'monthly_auto_release_run',j.id,'INSERT',jsonb_build_object('execution','automatic_rules','outcome','manual_required','reason',reason));
  return jsonb_build_object('state','manual_required','jobId',j.id,'draftId',j.draft_id,'reason',reason);
 end;
end $$;
create or replace function public.get_account_billing_overview(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b record;first_date date;enabled boolean;tz text;current_month date;last_month date;next_month date;draft_month date;target date;gap boolean;flow jsonb;j jsonb;result jsonb:='[]'::jsonb;
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 for b in select x.*,coalesce(a.label,x.account_id) label from public.ads_reporting_bindings x join public.ad_accounts a on a.id=x.ad_account_id where x.organization_id=p_org order by x.account_id loop
  first_date:=null;enabled:=false;tz:=null;current_month:=null;last_month:=null;next_month:=null;draft_month:=null;target:=null;gap:=false;flow:=null;j:=null;
  select c.first_month,c.enabled into first_date,enabled from public.monthly_automation_settings c where c.binding_id=b.id;
  select timezone into tz from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc,id desc limit 1;
  if tz is not null then current_month:=date_trunc('month',now() at time zone tz)::date;end if;
  select max(month) into last_month from public.monthly_client_statements where binding_id=b.id;
  -- The earliest missing month is either the first month or the successor of a published month.
  -- This avoids both skipping gaps and expanding decades of monthly dates.
  if first_date is not null and current_month is not null then
   select min(c.period) into next_month from (
    select first_date as period union select (s.month+interval '1 month')::date from public.monthly_client_statements s where s.binding_id=b.id and s.month>=first_date
   ) c where c.period>=first_date and c.period<current_month and not exists(select 1 from public.monthly_client_statements s where s.binding_id=b.id and s.month=c.period);
   gap:=coalesce(next_month is not null and last_month>next_month,false);
  end if;
  select min(d.month) into draft_month from public.monthly_settlement_drafts d where d.binding_id=b.id and not exists(select 1 from public.monthly_client_statements s where s.binding_id=b.id and s.month=d.month);
  target:=coalesce(next_month,draft_month,case when first_date is not null and current_month is not null then greatest(first_date,current_month) end);
  if target is not null then
   select value into flow from jsonb_array_elements(public.get_month_close_overview(p_org,target)->'accounts') where value->>'binding_id'=b.id::text;
  end if;
  select jsonb_build_object('month',q.month,'state',q.state,'error_code',q.error_code) into j from public.monthly_automation_jobs q where q.binding_id=b.id order by q.month desc limit 1;
  result:=result||jsonb_build_array(jsonb_build_object('binding_id',b.id,'account_id',b.account_id,'account_label',b.label,'active',b.active,'first_month',first_date,'automatic',coalesce(enabled,false),'timezone',tz,'current_month',current_month,'last_published_month',last_month,'next_month',next_month,'gap',gap,'task_month',target,'flow',flow,'job',j));
 end loop;
 return jsonb_build_object('organization_id',p_org,'accounts',result);
end $$;
create or replace function public.get_auto_release_state(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('source_difference_count',(select count(*) from public.monthly_statement_differences x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=p_binding),'policy',(select jsonb_build_object('enabled',enabled,'revision',revision,'max_minor',max_minor::text,'max_growth_bps',max_growth_bps,'canada_bps',canada_bps,'china_bps',china_bps,'transfer_bps',transfer_bps) from public.monthly_auto_release_policies where binding_id=p_binding),'runs',(select coalesce(jsonb_agg(t),'[]'::jsonb) from (select r.state,r.reason,r.draft_id,j.month from public.monthly_auto_release_runs r join public.monthly_automation_jobs j on j.id=r.job_id where r.binding_id=p_binding order by r.created_at desc limit 3)t));
end $$;
revoke all on function public.monthly_source_rows_valid(jsonb,date),public.monthly_source_fingerprint(jsonb),public.observe_monthly_source(uuid,uuid,jsonb),public.complete_monthly_automation(uuid,uuid,jsonb,jsonb),public.claim_statement_recheck(text),public.record_statement_recheck(uuid,uuid,jsonb),public.get_monthly_verification_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.observe_monthly_source(uuid,uuid,jsonb),public.complete_monthly_automation(uuid,uuid,jsonb,jsonb),public.claim_statement_recheck(text),public.record_statement_recheck(uuid,uuid,jsonb) to service_role;
grant execute on function public.get_monthly_verification_state(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
