-- Lifecycle/provenance are separate from immutable quote amounts. No deletion or ledger changes.
begin;
create table public.agency_quote_lifecycle (
 quote_id uuid primary key references public.agency_quote_snapshots(id),
 archived boolean not null,revision integer not null check(revision>0),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table public.agency_quote_derivations (
 quote_id uuid primary key references public.agency_quote_snapshots(id),
 parent_id uuid not null references public.agency_quote_snapshots(id),check(quote_id<>parent_id)
);
alter table public.agency_quote_lifecycle enable row level security;
alter table public.agency_quote_derivations enable row level security;
revoke all on public.agency_quote_lifecycle,public.agency_quote_derivations from public,anon,authenticated;
grant select on public.agency_quote_lifecycle,public.agency_quote_derivations to authenticated;
create policy admin_quote_lifecycle on public.agency_quote_lifecycle for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create policy admin_quote_derivations on public.agency_quote_derivations for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create trigger immutable_quote_derivation before update or delete on public.agency_quote_derivations for each row execute function public.lock_posted_money();
create function public.set_agency_quote_archived(p_id uuid,p_archived boolean,p_revision integer,p_note text) returns integer
language plpgsql security definer set search_path='' as $$
declare state public.agency_quote_lifecycle%rowtype; current_revision integer; result integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_archived is null or p_revision is null or p_revision<0 or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Invalid archive request' using errcode='22023'; end if;
 perform 1 from public.agency_quote_snapshots where id=p_id for update;
 if not found then raise exception 'Quote unavailable' using errcode='P0002'; end if;
 select * into state from public.agency_quote_lifecycle where quote_id=p_id;
 current_revision:=coalesce(state.revision,0);
 if coalesce(state.archived,false)=p_archived then return current_revision; end if;
 if current_revision<>p_revision then raise exception 'Archive state changed; refresh' using errcode='40001'; end if;
 result:=current_revision+1;
 insert into public.agency_quote_lifecycle(quote_id,archived,revision,updated_by) values(p_id,p_archived,result,auth.uid())
 on conflict(quote_id) do update set archived=excluded.archived,revision=excluded.revision,updated_by=auth.uid(),updated_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'quote_lifecycle',p_id,'UPDATE',jsonb_build_object('archived',p_archived,'revision',result,'note',btrim(p_note)));
 return result;
end $$;
create function public.save_agency_quote_revision(p_org uuid,p_period date,p_request uuid,p_fingerprint text,p_snapshot jsonb,p_parent uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; old_parent uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_parent is not null and not exists(select 1 from public.agency_quote_snapshots where id=p_parent and organization_id=p_org) then raise exception 'Parent quote unavailable for company' using errcode='42501'; end if;
 result:=public.save_agency_quote_snapshot(p_org,p_period,p_request,p_fingerprint,p_snapshot);
 select parent_id into old_parent from public.agency_quote_derivations where quote_id=result;
 if old_parent is not null and old_parent is distinct from p_parent then raise exception 'Parent changed' using errcode='40001'; end if;
 if p_parent is not null then
  if exists(with recursive ancestors(id) as (select p_parent union select d.parent_id from public.agency_quote_derivations d join ancestors a on d.quote_id=a.id) select 1 from ancestors where id=result) then raise exception 'Quote derivation cycle' using errcode='22023'; end if;
  insert into public.agency_quote_derivations(quote_id,parent_id) values(result,p_parent) on conflict(quote_id) do nothing;
 end if;
 return result;
end $$;
create function public.list_agency_quotes(p_org uuid,p_include_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.created_at desc,x.id desc) from (
 select s.id,s.created_at,jsonb_build_object('id',s.id,'organization_id',s.organization_id,'period',s.period,'revision',s.revision,
 'status',case when coalesce(l.archived,false) then 'archived' else 'draft' end,'state_revision',coalesce(l.revision,0),
 'parent_id',d.parent_id,'total_cny_minor',s.private_snapshot->>'finalMinor','created_at',s.created_at) record
 from public.agency_quote_snapshots s left join public.agency_quote_lifecycle l on l.quote_id=s.id left join public.agency_quote_derivations d on d.quote_id=s.id
 where s.organization_id=p_org and (coalesce(p_include_archived,false) or not coalesce(l.archived,false))
 order by s.created_at desc,s.id desc limit 20
 ) x),'[]'::jsonb);
end $$;
create or replace function public.get_agency_quote_results(p_org uuid) returns jsonb language sql stable security definer set search_path='' as $$ select public.list_agency_quotes(p_org,false); $$;
revoke all on function public.set_agency_quote_archived(uuid,boolean,integer,text),public.save_agency_quote_revision(uuid,date,uuid,text,jsonb,uuid),public.list_agency_quotes(uuid,boolean) from public,anon;
grant execute on function public.set_agency_quote_archived(uuid,boolean,integer,text),public.save_agency_quote_revision(uuid,date,uuid,text,jsonb,uuid),public.list_agency_quotes(uuid,boolean) to authenticated;
commit;
