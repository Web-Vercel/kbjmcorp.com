begin;
create table public.monthly_adjustment_drafts(id uuid primary key,binding_id uuid not null references public.ads_reporting_bindings(id),difference_id uuid not null references public.monthly_statement_differences(id),statement_id uuid not null references public.monthly_client_statements(id),amount_minor bigint not null,target_minor bigint not null,prior_adjustment_minor bigint not null,reference text not null check(char_length(btrim(reference)) between 3 and 1000),prepared_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
create table public.monthly_adjustment_reviews(draft_id uuid primary key references public.monthly_adjustment_drafts(id),decision text not null check(decision in ('approved','rejected')),note text not null check(char_length(btrim(note)) between 3 and 1000),reviewed_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp());
create table public.monthly_adjustment_publications(draft_id uuid primary key references public.monthly_adjustment_drafts(id),published_by uuid not null references auth.users(id),published_at timestamptz not null default clock_timestamp());
alter table public.monthly_adjustment_drafts enable row level security;alter table public.monthly_adjustment_reviews enable row level security;alter table public.monthly_adjustment_publications enable row level security;
revoke all on public.monthly_adjustment_drafts,public.monthly_adjustment_reviews,public.monthly_adjustment_publications from public,anon,authenticated,service_role;
create trigger immutable_adjustment_draft before update or delete on public.monthly_adjustment_drafts for each row execute function public.lock_posted_money();
create trigger immutable_adjustment_review before update or delete on public.monthly_adjustment_reviews for each row execute function public.lock_posted_money();
create trigger immutable_adjustment_publication before update or delete on public.monthly_adjustment_publications for each row execute function public.lock_posted_money();
create function public.monthly_difference_unresolved(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.monthly_adjustment_drafts a join public.monthly_adjustment_publications p on p.draft_id=a.id join public.monthly_statement_differences x on x.id=a.difference_id where a.statement_id=(select statement_id from public.monthly_statement_differences where id=p_id) and x.created_at>=(select created_at from public.monthly_statement_differences where id=p_id))
$$;
create function public.prepare_monthly_adjustment(p_difference uuid,p_request uuid,p_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare x public.monthly_statement_differences%rowtype;s public.monthly_client_statements%rowtype;d public.monthly_settlement_drafts%rowtype;q jsonb;a public.monthly_adjustment_drafts%rowtype;cad numeric;ca numeric;up numeric;cn numeric;fee numeric;total bigint;prior bigint;
begin
 select * into x from public.monthly_statement_differences where id=p_difference;
 select * into s from public.monthly_client_statements where id=x.statement_id for update;
 if s.id is null or not public.has_ops_capability('finance.prepare',s.organization_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_reference is null or char_length(btrim(p_reference)) not between 3 and 1000 then raise exception 'Adjustment evidence required' using errcode='22023';end if;
 select * into a from public.monthly_adjustment_drafts where id=p_request;
 if found then if a.difference_id=p_difference and a.prepared_by=auth.uid() and a.reference=btrim(p_reference) then return a.id;end if;raise exception 'Request differs' using errcode='40001';end if;
 if not public.monthly_difference_unresolved(x.id) or exists(select 1 from public.monthly_statement_differences where statement_id=s.id and created_at>x.created_at) then raise exception 'Difference resolved or superseded' using errcode='40001';end if;
 select * into d from public.monthly_settlement_drafts where id=s.draft_id;
 select private_snapshot into q from public.agency_quote_snapshots where id=d.quote_id;
 if s.publication_mode<>'automatic_rules' or q->>'calculationVersion' is distinct from 'two-agency-v1' then raise exception 'Supported original quote required' using errcode='22023';end if;
 cad:=round(x.observed_micros/10000,0);ca:=round(cad*(q#>>'{canadaRule,basisPoints}')::numeric/10000,0);up:=round((cad+ca)*(q->>'rate')::numeric,0);cn:=round(up*(q#>>'{chinaRule,basisPoints}')::numeric/10000,0);fee:=round(up*(q#>>'{transferRule,basisPoints}')::numeric/10000,0);total:=(up+cn+fee)::bigint;
 if total<0 or total>9999999999 then raise exception 'Adjustment amount invalid' using errcode='22023';end if;
 select coalesce(sum(z.amount_minor),0)::bigint into prior from public.monthly_adjustment_drafts z join public.monthly_adjustment_publications p on p.draft_id=z.id where z.statement_id=s.id;
 insert into public.monthly_adjustment_drafts(id,binding_id,difference_id,statement_id,amount_minor,target_minor,prior_adjustment_minor,reference,prepared_by) values(p_request,s.binding_id,x.id,s.id,total-s.total_cny_minor-prior,total,prior,btrim(p_reference),auth.uid());
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_adjustment',p_request,'INSERT',jsonb_build_object('statement_id',s.id,'amount_minor',(total-s.total_cny_minor-prior)::text,'no_posting',true));return p_request;
end $$;
create function public.review_monthly_adjustment(p_draft uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare a public.monthly_adjustment_drafts%rowtype;r public.monthly_adjustment_reviews%rowtype;org uuid;
begin
 select * into a from public.monthly_adjustment_drafts where id=p_draft for update;
 select organization_id into org from public.monthly_client_statements where id=a.statement_id;
 if org is null or not public.has_ops_capability('finance.review',org) or a.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review required' using errcode='22023';end if;
 select * into r from public.monthly_adjustment_reviews where draft_id=a.id;
 if found then if r.reviewed_by=auth.uid() and r.decision=p_decision and r.note=btrim(p_note) then return;end if;raise exception 'Review immutable' using errcode='40001';end if;
 if exists(select 1 from public.monthly_adjustment_publications where draft_id=a.id) then raise exception 'Already published' using errcode='40001';end if;
 insert into public.monthly_adjustment_reviews(draft_id,decision,note,reviewed_by) values(a.id,p_decision,btrim(p_note),auth.uid());
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_adjustment_review',a.id,'INSERT',jsonb_build_object('decision',p_decision,'no_posting',true));
end $$;
create function public.publish_monthly_adjustment(p_draft uuid,p_test_org uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.monthly_adjustment_drafts%rowtype;s public.monthly_client_statements%rowtype;x public.monthly_statement_differences%rowtype;prior bigint;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into a from public.monthly_adjustment_drafts where id=p_draft;
 select * into s from public.monthly_client_statements where id=a.statement_id;
 perform 1 from public.client_wallets where id=s.wallet_id for update;
 select * into s from public.monthly_client_statements where id=a.statement_id for update;
 select * into a from public.monthly_adjustment_drafts where id=p_draft for update;
 if a.id is null then raise exception 'Adjustment unavailable' using errcode='22023';end if;
 if exists(select 1 from public.monthly_adjustment_publications where draft_id=a.id) then return a.id;end if;
 if p_test_org is not null and (s.organization_id<>p_test_org or not exists(select 1 from public.organizations where id=p_test_org and name='财务流程验收企业（虚构）')) then raise exception 'Test scope required' using errcode='42501';end if;
 if not exists(select 1 from public.monthly_adjustment_reviews where draft_id=a.id and decision='approved' and reviewed_by<>a.prepared_by) then raise exception 'Independent approval required' using errcode='23514';end if;
 select * into x from public.monthly_statement_differences where id=a.difference_id;
 if not public.monthly_difference_unresolved(x.id) or exists(select 1 from public.monthly_statement_differences where statement_id=s.id and created_at>x.created_at) then raise exception 'Difference resolved or superseded' using errcode='40001';end if;
 select coalesce(sum(z.amount_minor),0)::bigint into prior from public.monthly_adjustment_drafts z join public.monthly_adjustment_publications p on p.draft_id=z.id where z.statement_id=s.id;
 if prior<>a.prior_adjustment_minor or a.target_minor<>s.total_cny_minor+prior+a.amount_minor then raise exception 'Prior adjustments changed; prepare again' using errcode='40001';end if;
 if a.amount_minor>0 and public.refund_available(s.wallet_id)<a.amount_minor then raise exception 'Insufficient available balance' using errcode='22023';end if;
 insert into public.monthly_adjustment_publications(draft_id,published_by) values(a.id,auth.uid());
 if a.amount_minor<>0 then insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(s.wallet_id,s.organization_id,'CNY','adjustment',-a.amount_minor,to_char(s.month,'YYYY-MM')||' 月度账单调整 / Statement adjustment','monthly-adjustment:'||a.id::text);end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_adjustment_publication',a.id,'INSERT',jsonb_build_object('statement_id',s.id,'amount_minor',a.amount_minor::text,'original_unchanged',true));return a.id;
end $$;
create function public.list_monthly_adjustments(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('can_prepare',public.has_ops_capability('finance.prepare',org),'can_review',public.has_ops_capability('finance.review',org),'can_publish',public.has_staff_access(array['admin']::text[]),'items',(select coalesce(jsonb_agg(t),'[]') from (select a.id,a.difference_id,a.statement_id,a.amount_minor::text,a.target_minor::text,a.reference,a.prepared_by=auth.uid() as prepared_by_me,r.decision,p.published_at from public.monthly_adjustment_drafts a left join public.monthly_adjustment_reviews r on r.draft_id=a.id left join public.monthly_adjustment_publications p on p.draft_id=a.id where a.binding_id=p_binding order by a.created_at desc limit 30)t));
end $$;
create function public.get_client_statement_adjustments(p_statement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.monthly_client_statements where id=p_statement;
 if org is null or not public.has_finance_access(org) then raise exception 'Forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(t),'[]') from (select a.id,a.statement_id,a.amount_minor::text,p.published_at from public.monthly_adjustment_drafts a join public.monthly_adjustment_publications p on p.draft_id=a.id where a.statement_id=p_statement order by p.published_at)t);
end $$;
alter table public.monthly_statement_differences add column baseline_id uuid;
-- No financial history is altered: existing NULL baseline values use the statement ID in the dedup index.
alter table public.monthly_statement_differences drop constraint monthly_statement_differences_statement_id_fingerprint_key;
create unique index monthly_difference_baseline_unique on public.monthly_statement_differences(statement_id,coalesce(baseline_id,statement_id),fingerprint);
create or replace function public.record_statement_recheck(p_statement uuid,p_lease uuid,p_report jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.monthly_client_statements%rowtype;d public.monthly_settlement_drafts%rowtype;old public.ads_reporting_snapshots%rowtype;r public.monthly_statement_rechecks%rowtype;fp text;amount numeric;baseline jsonb;epoch uuid;
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
 select z.report,a.id into baseline,epoch from public.monthly_adjustment_drafts a join public.monthly_adjustment_publications p on p.draft_id=a.id join public.monthly_statement_differences z on z.id=a.difference_id where a.statement_id=s.id order by p.published_at desc limit 1;
 if fp is distinct from public.monthly_source_fingerprint(coalesce(baseline,old.report)) then
 insert into public.monthly_statement_differences(statement_id,fingerprint,original_micros,observed_micros,report,baseline_id) values(p_statement,fp,coalesce((baseline->>'periodSpendMicros')::numeric,old.period_spend_micros),amount,p_report,coalesce(epoch,s.id)) on conflict do nothing;
 return jsonb_build_object('state','manual_required','statementId',s.id,'reason','posted_source_changed');end if;
 return jsonb_build_object('state','idle');
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
  if exists(select 1 from public.monthly_statement_differences x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=b.id and public.monthly_difference_unresolved(x.id)) then raise exception 'Release blocked';end if;
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
create or replace function public.get_auto_release_state(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('source_difference_count',(select count(*) from public.monthly_statement_differences x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=p_binding and public.monthly_difference_unresolved(x.id)),'policy',(select jsonb_build_object('enabled',enabled,'revision',revision,'max_minor',max_minor::text,'max_growth_bps',max_growth_bps,'canada_bps',canada_bps,'china_bps',china_bps,'transfer_bps',transfer_bps) from public.monthly_auto_release_policies where binding_id=p_binding),'runs',(select coalesce(jsonb_agg(t),'[]'::jsonb) from (select r.state,r.reason,r.draft_id,j.month from public.monthly_auto_release_runs r join public.monthly_automation_jobs j on j.id=r.job_id where r.binding_id=p_binding order by r.created_at desc limit 3)t));
end $$;
create or replace function public.get_monthly_verification_state(p_binding uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.ads_reporting_bindings where id=p_binding;
 if org is null or not public.has_ops_capability('finance.read',org) then raise exception 'Forbidden' using errcode='42501';end if;
 return jsonb_build_object('monitoring',(select coalesce(jsonb_agg(t),'[]') from (select x.checked_at,x.error_code from public.monthly_statement_rechecks x join public.monthly_client_statements y on y.id=x.statement_id where y.binding_id=p_binding order by x.checked_at desc nulls last limit 3)t),'jobs',(select coalesce(jsonb_agg(t),'[]') from (select j.id,j.month,j.state,j.error_code,j.available_at,(select count(*) from public.monthly_source_observations o where o.job_id=j.id)::integer as reads from public.monthly_automation_jobs j where binding_id=p_binding order by month desc limit 3)t),'differences',(select coalesce(jsonb_agg(t),'[]') from (select x.id,x.statement_id,s.month,not public.monthly_difference_unresolved(x.id) as resolved,x.original_micros::text,x.observed_micros::text,x.created_at from public.monthly_statement_differences x join public.monthly_client_statements s on s.id=x.statement_id where s.binding_id=p_binding order by x.created_at desc limit 20)t));
end $$;
revoke all on function public.monthly_difference_unresolved(uuid),public.prepare_monthly_adjustment(uuid,uuid,text),public.review_monthly_adjustment(uuid,text,text),public.publish_monthly_adjustment(uuid,uuid),public.list_monthly_adjustments(uuid),public.get_client_statement_adjustments(uuid) from public,anon,authenticated,service_role;
grant execute on function public.prepare_monthly_adjustment(uuid,uuid,text),public.review_monthly_adjustment(uuid,text,text),public.publish_monthly_adjustment(uuid,uuid),public.list_monthly_adjustments(uuid),public.get_client_statement_adjustments(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
