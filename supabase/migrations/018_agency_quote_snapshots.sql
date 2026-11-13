-- Immutable internal quote drafts. Never publishes a report, bills, pays or posts money.
begin;
create table public.agency_quote_snapshots (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 period date not null check(extract(day from period)=1),revision integer not null check(revision>0),
 request_id uuid not null,request_fingerprint text not null check(request_fingerprint ~ '^[0-9a-f]{64}$'),
 private_snapshot jsonb not null check(jsonb_typeof(private_snapshot)='object' and octet_length(private_snapshot::text)<=32768),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 unique(created_by,request_id),unique(organization_id,period,revision)
);
alter table public.agency_quote_snapshots enable row level security;
revoke all on public.agency_quote_snapshots from public,anon,authenticated;
grant select on public.agency_quote_snapshots to authenticated;
create policy admin_quote_snapshot on public.agency_quote_snapshots for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create trigger immutable_quote_snapshot before update or delete on public.agency_quote_snapshots for each row execute function public.lock_posted_money();
create function public.save_agency_quote_snapshot(p_org uuid,p_period date,p_request uuid,p_fingerprint text,p_snapshot jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare old_record public.agency_quote_snapshots%rowtype; result uuid; version integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into old_record from public.agency_quote_snapshots where created_by=auth.uid() and request_id=p_request;
 if found then
  if old_record.request_fingerprint is distinct from p_fingerprint or old_record.organization_id is distinct from p_org or old_record.period is distinct from p_period or old_record.private_snapshot is distinct from p_snapshot then raise exception 'Request changed; create a new draft' using errcode='40001'; end if;
  return old_record.id;
 end if;
 if p_snapshot->>'status' is distinct from 'draft' or p_snapshot->>'calculationVersion' is distinct from 'two-agency-v1' or coalesce(p_snapshot->>'finalMinor','') !~ '^[0-9]{1,18}$' then raise exception 'Draft calculation required' using errcode='22023'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if not found then raise exception 'Company unavailable' using errcode='22023'; end if;
 select coalesce(max(s.revision),0)+1 into version from public.agency_quote_snapshots s where s.organization_id=p_org and s.period=p_period;
 insert into public.agency_quote_snapshots(organization_id,period,revision,request_id,request_fingerprint,private_snapshot,created_by)
 values(p_org,p_period,version,p_request,p_fingerprint,p_snapshot,auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'agency_quote_snapshot',result,'INSERT',jsonb_build_object('organization_id',p_org,'period',p_period,'revision',version,'draft_only',true));
 return result;
end $$;
revoke all on function public.save_agency_quote_snapshot(uuid,date,uuid,text,jsonb) from public,anon;
grant execute on function public.save_agency_quote_snapshot(uuid,date,uuid,text,jsonb) to authenticated;
create function public.get_agency_quote_results(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.created_at desc,x.id desc) from (
 select s.id,s.created_at,jsonb_build_object('id',s.id,'organization_id',s.organization_id,'period',s.period,'revision',s.revision,'status','draft','total_cny_minor',s.private_snapshot->>'finalMinor','created_at',s.created_at) record
 from public.agency_quote_snapshots s where s.organization_id=p_org order by s.created_at desc,s.id desc limit 20
 ) x),'[]'::jsonb);
end $$;
revoke all on function public.get_agency_quote_results(uuid) from public,anon;
grant execute on function public.get_agency_quote_results(uuid) to authenticated;
commit;
