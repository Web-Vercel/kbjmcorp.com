-- Internal API acceptance snapshots only. No customer mapping, billing or ledger posting.
begin;
create table public.ads_reporting_snapshots (
 id uuid primary key default gen_random_uuid(),request_id uuid not null,
 account_id text not null,account_name text not null,currency text not null,timezone text not null,
 since date not null,until date not null,check_status text not null check(check_status in ('matched','difference','no_data')),
 daily_spend_micros numeric(18,0) not null check(daily_spend_micros>=0),
 period_spend_micros numeric(18,0) check(period_spend_micros>=0),
 report jsonb not null check(jsonb_typeof(report)='object' and octet_length(report::text)<=786432),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(created_by,request_id),check(until=since+6)
);
create index ads_reporting_recent on public.ads_reporting_snapshots(created_at desc);
alter table public.ads_reporting_snapshots enable row level security;
revoke all on public.ads_reporting_snapshots from public,anon,authenticated;
grant select on public.ads_reporting_snapshots to authenticated;
create policy admin_ads_reporting on public.ads_reporting_snapshots for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create trigger immutable_ads_reporting before update or delete on public.ads_reporting_snapshots for each row execute function public.lock_posted_money();
create function public.save_ads_reporting_snapshot(p_request uuid,p_report jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare prior public.ads_reporting_snapshots%rowtype; result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_request is null or p_report->>'version' is distinct from 'ads-readonly-v1'
 or coalesce(p_report#>>'{account,id}','') !~ '^adacct_[A-Za-z0-9_-]+$'
 or coalesce(p_report#>>'{account,currency_code}','') !~ '^[A-Z]{3}$'
 or coalesce(p_report->>'dailySpendMicros','') !~ '^[0-9]{1,18}$'
 or coalesce(p_report->>'rawSha256','') !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_report->'daily') is distinct from 'array'
 or jsonb_typeof(p_report->'rawResponses') is distinct from 'array'
 then raise exception 'Invalid report' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into prior from public.ads_reporting_snapshots where created_by=auth.uid() and request_id=p_request;
 if found then
  if prior.report is distinct from p_report then raise exception 'Request changed' using errcode='40001'; end if;
  return prior.id;
 end if;
 insert into public.ads_reporting_snapshots(request_id,account_id,account_name,currency,timezone,since,until,check_status,daily_spend_micros,period_spend_micros,report,created_by)
 values(p_request,p_report#>>'{account,id}',p_report#>>'{account,name}',p_report#>>'{account,currency_code}',p_report#>>'{account,timezone}',(p_report->>'since')::date,(p_report->>'until')::date,p_report->>'check',(p_report->>'dailySpendMicros')::numeric,(p_report->>'periodSpendMicros')::numeric,p_report,auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_readonly_snapshot',result,'INSERT',jsonb_build_object('account_id',p_report#>>'{account,id}','internal_only',true,'no_ledger_posting',true));
 return result;
end $$;
revoke all on function public.save_ads_reporting_snapshot(uuid,jsonb) from public,anon;
grant execute on function public.save_ads_reporting_snapshot(uuid,jsonb) to authenticated;
commit;
