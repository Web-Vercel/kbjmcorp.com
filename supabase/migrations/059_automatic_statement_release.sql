-- Preview-only explicit automatic publication authorization. No account is enabled by this migration.
begin;
create table public.monthly_auto_release_policies(
 binding_id uuid primary key references public.ads_reporting_bindings(id),enabled boolean not null default false,
 revision integer not null default 1,settings_revision integer not null,first_month date not null,
 canada_bps integer not null check(canada_bps between 0 and 10000),china_bps integer not null check(china_bps between 0 and 10000),transfer_bps integer not null check(transfer_bps between 0 and 10000),
 max_minor bigint not null check(max_minor between 1 and 9999999999),max_growth_bps integer not null check(max_growth_bps between 0 and 100000),
 agreement text not null check(char_length(btrim(agreement)) between 3 and 1000),authorized_by uuid not null references auth.users(id),authorized_at timestamptz not null default now()
);
create table public.monthly_auto_release_runs(
 id uuid primary key default gen_random_uuid(),job_id uuid not null unique references public.monthly_automation_jobs(id),binding_id uuid not null references public.ads_reporting_bindings(id),draft_id uuid not null unique references public.monthly_settlement_drafts(id),
 policy_revision integer not null,state text not null check(state in ('passed','blocked')),reason text,proof jsonb not null,created_at timestamptz not null default now()
);
alter table public.monthly_auto_release_policies enable row level security;
alter table public.monthly_auto_release_runs enable row level security;
revoke all on public.monthly_auto_release_policies,public.monthly_auto_release_runs from public,anon,authenticated,service_role;
grant select on public.monthly_auto_release_policies to authenticated;
create policy auto_policy_admin on public.monthly_auto_release_policies for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create trigger immutable_auto_release_run before update or delete on public.monthly_auto_release_runs for each row execute function public.lock_posted_money();
alter table public.monthly_client_statements alter column published_by drop not null;
alter table public.monthly_client_statements add column publication_mode text not null default 'manual' check(publication_mode in ('manual','automatic_rules')),
 add column auto_release_id uuid unique references public.monthly_auto_release_runs(id),
 add constraint statement_publisher_identity check((publication_mode='manual' and published_by is not null and auto_release_id is null) or (publication_mode='automatic_rules' and published_by is null and auto_release_id is not null));
create function public.configure_monthly_auto_release(p_binding uuid,p_enabled boolean,p_canada integer,p_china integer,p_transfer integer,p_max bigint,p_growth integer,p_agreement text) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.monthly_automation_settings%rowtype;v integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.ads_reporting_bindings where id=p_binding and active for update;
 if not found then raise exception 'Active binding required' using errcode='22023';end if;
 select * into c from public.monthly_automation_settings where binding_id=p_binding for share;
 if c.first_month is null or (p_enabled and not c.enabled) then raise exception 'Configure automatic preparation and first month first' using errcode='22023';end if;
 if p_enabled is null or p_agreement is null or char_length(btrim(p_agreement)) not between 3 and 1000 then raise exception 'Explicit authorization required' using errcode='22023';end if;
 insert into public.monthly_auto_release_policies(binding_id,enabled,settings_revision,first_month,canada_bps,china_bps,transfer_bps,max_minor,max_growth_bps,agreement,authorized_by)
 values(p_binding,p_enabled,c.revision,c.first_month,p_canada,p_china,p_transfer,p_max,p_growth,btrim(p_agreement),auth.uid())
 on conflict(binding_id) do update set enabled=excluded.enabled,settings_revision=excluded.settings_revision,first_month=excluded.first_month,canada_bps=excluded.canada_bps,china_bps=excluded.china_bps,transfer_bps=excluded.transfer_bps,max_minor=excluded.max_minor,max_growth_bps=excluded.max_growth_bps,agreement=excluded.agreement,authorized_by=excluded.authorized_by,authorized_at=now(),revision=public.monthly_auto_release_policies.revision+1 returning revision into v;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_auto_release_policy',p_binding,'UPDATE',jsonb_build_object('enabled',p_enabled,'revision',v,'authorization','automatic_publication_and_prepaid_debit','max_minor',p_max::text,'max_growth_bps',p_growth,'canada_bps',p_canada,'china_bps',p_china,'transfer_bps',p_transfer,'settings_revision',c.revision,'agreement',btrim(p_agreement)));
 return v;
end $$;
create function public.post_monthly_statement_internal(p_draft uuid,p_summary text,p_expected jsonb,p_release uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.monthly_settlement_drafts%rowtype;b public.ads_reporting_bindings%rowtype;q public.agency_quote_snapshots%rowtype;s public.ads_reporting_snapshots%rowtype;w public.client_wallets%rowtype;
 prior public.monthly_client_statements%rowtype;result uuid;upstream bigint;service bigint;total bigint;balance numeric;public_usage jsonb;effective jsonb;
begin
 if p_release is null then
  if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 elsif not exists(select 1 from public.monthly_auto_release_runs r join public.monthly_auto_release_policies p on p.binding_id=r.binding_id and p.revision=r.policy_revision and p.enabled where r.id=p_release and r.draft_id=p_draft and r.state='passed') then
  raise exception 'System release proof required' using errcode='42501';
 end if;
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
 if p_release is null and not exists(select 1 from public.monthly_settlement_reviews where draft_id=d.id and decision='approved' and reviewed_by<>d.prepared_by) then raise exception 'Independent approval required' using errcode='23514'; end if;
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
 insert into public.monthly_client_statements(draft_id,organization_id,binding_id,wallet_id,month,upstream_cny_minor,service_cny_minor,total_cny_minor,summary_zh,usage,published_by,publication_mode,auto_release_id)
 values(d.id,d.organization_id,b.id,w.id,d.month,upstream,service,total,btrim(p_summary),public_usage,case when p_release is null then auth.uid() end,case when p_release is null then 'manual' else 'automatic_rules' end,p_release) returning id into result;
 if upstream>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference)
 values(w.id,w.organization_id,'CNY','ad_spend',-upstream,'月度广告及执行服务 / Monthly advertising and execution','monthly-statement:'||result::text); end if;
 if service>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference)
 values(w.id,w.organization_id,'CNY','service_fee',-service,'约定运营服务及其他费用 / Agreed operating and other fees','monthly-statement:'||result::text); end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(case when p_release is null then auth.uid() end,'monthly_client_statement',result,'INSERT',jsonb_build_object('draft_id',d.id,'total_cny_minor',total::text,'atomic_ledger_posting',true,'execution',case when p_release is null then 'manual' else 'automatic_rules' end,'release_id',p_release));
 return result;
end $$;
create or replace function public.publish_monthly_statement(p_draft uuid,p_summary text,p_expected jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 return public.post_monthly_statement_internal(p_draft,p_summary,p_expected,null);
end $$;
-- Serialize new billing disputes with wallet publication; later disputes remain normal post-publication cases.
create function public.lock_billing_dispute_wallet() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.category='billing' or NEW.statement_id is not null then perform 1 from public.client_wallets where organization_id=NEW.organization_id and currency='CNY' for update;end if;
 return NEW;
end $$;
create trigger billing_dispute_wallet_lock before insert or update on public.service_requests for each row execute function public.lock_billing_dispute_wallet();
-- Source arrivals and review decisions serialize against the account/draft being released.
alter table public.ads_reporting_snapshots alter column created_at set default clock_timestamp();
create function public.lock_auto_release_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.ads_reporting_bindings where account_id=NEW.account_id for update;
 NEW.created_at:=clock_timestamp();
 return NEW;
end $$;
create trigger auto_release_source_lock before insert on public.ads_reporting_snapshots for each row execute function public.lock_auto_release_source();
create function public.reject_review_after_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.monthly_settlement_drafts where id=NEW.draft_id for update;
 if exists(select 1 from public.monthly_client_statements where draft_id=NEW.draft_id) then raise exception 'Published statement cannot receive a new review' using errcode='40001';end if;
 return NEW;
end $$;
create trigger review_publication_guard before insert on public.monthly_settlement_reviews for each row execute function public.reject_review_after_publication();
create index auto_release_pending_jobs on public.monthly_automation_jobs(binding_id,month) where state='prepared';
create index auto_release_recent_runs on public.monthly_auto_release_runs(binding_id,created_at desc);
create index auto_release_month_sources on public.ads_reporting_snapshots(account_id,since,until,created_at desc);
create function public.release_automatic_month(p_account text,p_test_org uuid) returns jsonb
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
  reason:='reference_invalid';ref:=q.private_snapshot->'referenceProof';
  if coalesce(ref->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or nullif(ref->>'fetchedAt','') is null or ref->>'source' is distinct from 'Bank of Canada' or ref->>'series' is distinct from 'FXCNYCAD' or ref->>'policy' is distinct from 'month_end_last_published'
   or ref->>'billingMonth' is distinct from to_char(j.month,'YYYY-MM') or ref->>'rate' is distinct from q.private_snapshot->>'rate'
   or ref->>'date' is distinct from q.private_snapshot->>'referenceDate' or ref->>'sourceUrl' is distinct from ('https://www.bankofcanada.ca/valet/observations/FXCNYCAD/json?start_date='||j.month::text||'&end_date='||end_date::text)
   or ((ref->>'fetchedAt')::timestamptz at time zone 'America/Toronto')::date<=end_date or (ref->>'date')::date<j.month or (ref->>'date')::date>end_date or end_date-(ref->>'date')::date>7
   or coalesce(ref->>'rate','') !~ '^[0-9]{1,4}\.[0-9]{8}$' or (ref->>'rate')::numeric<=0
   or coalesce(ref->>'originalCnyCad','') !~ '^[0-9]{1,4}(\.[0-9]{1,12})?$' or (ref->>'originalCnyCad')::numeric<=0
   or round(1/(ref->>'originalCnyCad')::numeric,8)<>(ref->>'rate')::numeric or (ref->>'fetchedAt')::timestamptz>now()+interval '5 minutes' then raise exception 'Release blocked';end if;
  proof:=proof||jsonb_build_array('source_and_reference');
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
  if total>p.max_minor then raise exception 'Release blocked';end if;
  select total_cny_minor into previous from public.monthly_client_statements where binding_id=b.id and month<j.month order by month desc limit 1;
  if previous is not null and ((previous=0 and total>0) or (previous>0 and abs(total-previous)::numeric*10000>previous::numeric*p.max_growth_bps)) then raise exception 'Release blocked';end if;
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
create function public.get_auto_release_state(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('policy',(select jsonb_build_object('enabled',enabled,'revision',revision,'max_minor',max_minor::text,'max_growth_bps',max_growth_bps,'canada_bps',canada_bps,'china_bps',china_bps,'transfer_bps',transfer_bps) from public.monthly_auto_release_policies where binding_id=p_binding),'runs',(select coalesce(jsonb_agg(t),'[]'::jsonb) from (select r.state,r.reason,r.draft_id,j.month from public.monthly_auto_release_runs r join public.monthly_automation_jobs j on j.id=r.job_id where r.binding_id=p_binding order by r.created_at desc limit 3)t));
end $$;
create or replace function public.list_monthly_statement_receipts(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'draft_id',draft_id,'month',month,'total_cny_minor',total_cny_minor::text,'published_at',published_at,'publication_mode',publication_mode,'auto_release_id',auto_release_id) order by published_at desc)
 from (select * from public.monthly_client_statements where organization_id=p_org order by published_at desc limit 50)s),'[]'::jsonb);
end $$;
create or replace function public.list_monthly_statement_receipts(p_org uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is null or extract(day from p_month)<>1 then raise exception 'First day required' using errcode='22023';end if;
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'draft_id',draft_id,'month',month,'total_cny_minor',total_cny_minor::text,'published_at',published_at,'publication_mode',publication_mode,'auto_release_id',auto_release_id) order by published_at desc) from (select * from public.monthly_client_statements where organization_id=p_org and month=p_month order by published_at desc limit 50)s),'[]'::jsonb);
end $$;
revoke all on function public.post_monthly_statement_internal(uuid,text,jsonb,uuid),public.lock_billing_dispute_wallet(),public.lock_auto_release_source(),public.reject_review_after_publication(),public.configure_monthly_auto_release(uuid,boolean,integer,integer,integer,bigint,integer,text),public.release_automatic_month(text,uuid),public.get_auto_release_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.configure_monthly_auto_release(uuid,boolean,integer,integer,integer,bigint,integer,text),public.get_auto_release_state(uuid) to authenticated;
grant execute on function public.release_automatic_month(text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
