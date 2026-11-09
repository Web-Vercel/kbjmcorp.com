-- Traceable source + quote preparation and independent review. No statement publication or wallet posting.
begin;
create table public.monthly_settlement_drafts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 binding_id uuid not null references public.ads_reporting_bindings(id),snapshot_id uuid not null references public.ads_reporting_snapshots(id),
 quote_id uuid not null unique references public.agency_quote_snapshots(id),month date not null,
 source_cad_minor bigint not null check(source_cad_minor>=0),total_cny_minor bigint not null check(total_cny_minor>=0),
 agreement_reference text not null check(char_length(btrim(agreement_reference)) between 3 and 1000),
 note text not null check(char_length(btrim(note)) between 3 and 1000),
 prepared_by uuid not null references auth.users(id),prepared_at timestamptz not null default now()
);
create table public.monthly_settlement_reviews (
 draft_id uuid primary key references public.monthly_settlement_drafts(id),decision text not null check(decision in ('approved','rejected')),
 note text not null check(char_length(btrim(note)) between 3 and 1000),reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default now()
);
alter table public.monthly_settlement_drafts enable row level security;
alter table public.monthly_settlement_reviews enable row level security;
revoke all on public.monthly_settlement_drafts,public.monthly_settlement_reviews from public,anon,authenticated;
-- Finance reads only the whitelisted, capability-scoped RPC projection below.
create trigger immutable_monthly_draft before update or delete on public.monthly_settlement_drafts for each row execute function public.lock_posted_money();
create trigger immutable_monthly_review before update or delete on public.monthly_settlement_reviews for each row execute function public.lock_posted_money();
create function public.prepare_monthly_settlement(p_snapshot uuid,p_quote uuid,p_agreement text,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.ads_reporting_snapshots%rowtype;b public.ads_reporting_bindings%rowtype;q public.agency_quote_snapshots%rowtype;prior public.monthly_settlement_drafts%rowtype;result uuid;cad bigint;days integer;
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
 insert into public.monthly_settlement_drafts(organization_id,binding_id,snapshot_id,quote_id,month,source_cad_minor,total_cny_minor,agreement_reference,note,prepared_by)
 values(q.organization_id,b.id,s.id,q.id,q.period,cad,(q.private_snapshot->>'finalMinor')::bigint,btrim(p_agreement),btrim(p_note),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_settlement_draft',result,'INSERT',jsonb_build_object('snapshot_id',s.id,'quote_id',q.id,'no_ledger_posting',true));
 return result;
end $$;
create function public.review_monthly_settlement(p_draft uuid,p_decision text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.monthly_settlement_drafts%rowtype;r public.monthly_settlement_reviews%rowtype;
begin
 select * into d from public.monthly_settlement_drafts where id=p_draft for update;
 if not found or not public.has_ops_capability('finance.review',d.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if d.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review input required' using errcode='22023'; end if;
 select * into r from public.monthly_settlement_reviews where draft_id=d.id;
 if found then
  if r.decision=p_decision and r.note=btrim(p_note) and r.reviewed_by=auth.uid() then return; end if;
  raise exception 'Review already recorded' using errcode='40001';
 end if;
 perform 1 from public.ads_reporting_bindings where id=d.binding_id and active for share;
 if not found then raise exception 'Source access paused' using errcode='40001'; end if;
 -- Serialize with quote archival so a stale quote cannot be approved concurrently.
 perform 1 from public.agency_quote_snapshots where id=d.quote_id for update;
 if p_decision='approved' and exists(select 1 from public.agency_quote_lifecycle where quote_id=d.quote_id and archived) then raise exception 'Quote archived' using errcode='40001'; end if;
 insert into public.monthly_settlement_reviews(draft_id,decision,note,reviewed_by) values(d.id,p_decision,btrim(p_note),auth.uid());
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'monthly_settlement_review',d.id,'INSERT',jsonb_build_object('decision',p_decision,'no_ledger_posting',true));
end $$;
create function public.list_monthly_settlements(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.prepared_at desc,x.id desc) from (
 select d.id,d.prepared_at,jsonb_build_object('id',d.id,'month',d.month,'snapshot_id',d.snapshot_id,'quote_id',d.quote_id,'quote_revision',q.revision,
 'source_cad_minor',d.source_cad_minor::text,'total_cny_minor',d.total_cny_minor::text,'agreement_reference',d.agreement_reference,'note',d.note,'prepared_by',d.prepared_by,'prepared_at',d.prepared_at,
 'status',coalesce(r.decision,'pending'),'review_note',r.note,'reviewed_at',r.reviewed_at,'quote_archived',coalesce(l.archived,false)) record
 from public.monthly_settlement_drafts d join public.ads_reporting_bindings b on b.id=d.binding_id and b.active join public.agency_quote_snapshots q on q.id=d.quote_id
 left join public.monthly_settlement_reviews r on r.draft_id=d.id left join public.agency_quote_lifecycle l on l.quote_id=d.quote_id
 where d.organization_id=p_org order by d.prepared_at desc,d.id desc limit 50
 )x),'[]'::jsonb);
end $$;
revoke all on function public.prepare_monthly_settlement(uuid,uuid,text,text),public.review_monthly_settlement(uuid,text,text),public.list_monthly_settlements(uuid) from public,anon;
grant execute on function public.prepare_monthly_settlement(uuid,uuid,text,text),public.review_monthly_settlement(uuid,text,text),public.list_monthly_settlements(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
