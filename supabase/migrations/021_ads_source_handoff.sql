-- Explicit advertiser ownership and immutable, scoped internal source handoffs.
-- No customer publication, role grants, schedule, fee calculation or ledger writes.
begin;
create table public.ads_reporting_bindings (
 id uuid primary key default gen_random_uuid(),account_id text not null unique,
 ad_account_id uuid not null,organization_id uuid not null references public.organizations(id),
 ownership_reference text not null check(char_length(btrim(ownership_reference)) between 3 and 1000),
 active boolean not null default true,revision integer not null default 1 check(revision>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id)
);
create table public.ads_source_handoffs (
 id uuid primary key default gen_random_uuid(),snapshot_id uuid not null unique references public.ads_reporting_snapshots(id),
 binding_id uuid not null references public.ads_reporting_bindings(id),
 note text not null check(char_length(btrim(note)) between 3 and 1000),
 shared_by uuid not null references auth.users(id),shared_at timestamptz not null default now()
);
alter table public.ads_reporting_bindings enable row level security;
alter table public.ads_source_handoffs enable row level security;
revoke all on public.ads_reporting_bindings,public.ads_source_handoffs from public,anon,authenticated;
grant select on public.ads_reporting_bindings,public.ads_source_handoffs to authenticated;
create policy admin_ads_bindings on public.ads_reporting_bindings for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create policy admin_ads_handoffs on public.ads_source_handoffs for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create trigger immutable_ads_handoff before update or delete on public.ads_source_handoffs for each row execute function public.lock_posted_money();
create function public.protect_ads_binding_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Binding history is immutable; pause access' using errcode='42501'; end if;
 if NEW.id is distinct from OLD.id or NEW.account_id is distinct from OLD.account_id or NEW.ad_account_id is distinct from OLD.ad_account_id or NEW.organization_id is distinct from OLD.organization_id or NEW.ownership_reference is distinct from OLD.ownership_reference or NEW.created_by is distinct from OLD.created_by or NEW.created_at is distinct from OLD.created_at then raise exception 'Binding destination is immutable' using errcode='42501'; end if;
 return NEW;
end $$;
revoke all on function public.protect_ads_binding_identity() from public,anon,authenticated;
create trigger protect_ads_binding before update or delete on public.ads_reporting_bindings for each row execute function public.protect_ads_binding_identity();
create function public.bind_ads_reporting_account(p_snapshot uuid,p_org uuid,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare source public.ads_reporting_snapshots%rowtype; prior public.ads_reporting_bindings%rowtype; account public.ad_accounts%rowtype; result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_reference is null or char_length(btrim(p_reference)) not between 3 and 1000 then raise exception 'Ownership evidence required' using errcode='22023'; end if;
 select * into source from public.ads_reporting_snapshots where id=p_snapshot;
 if not found then raise exception 'Source unavailable' using errcode='22023'; end if;
 perform 1 from public.organizations where id=p_org;if not found then raise exception 'Company unavailable' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('ads-binding:'||source.account_id,0));
 select * into prior from public.ads_reporting_bindings where account_id=source.account_id;
 if found then
  if prior.organization_id is distinct from p_org then raise exception 'Account already linked to another company' using errcode='23505'; end if;
  return prior.id;
 end if;
 select * into account from public.ad_accounts where platform='openai_ads' and external_id=source.account_id;
 if found and account.organization_id is distinct from p_org then raise exception 'Account already linked to another company' using errcode='23505'; end if;
 if account.id is null then
  insert into public.ad_accounts(organization_id,platform,external_id,label) values(p_org,'openai_ads',source.account_id,source.account_name) returning * into account;
 end if;
 insert into public.ads_reporting_bindings(account_id,ad_account_id,organization_id,ownership_reference,created_by,updated_by)
 values(source.account_id,account.id,p_org,btrim(p_reference),auth.uid(),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_reporting_binding',result,'INSERT',jsonb_build_object('organization_id',p_org,'account_id',source.account_id,'explicit_ownership_check',true));
 return result;
end $$;
create function public.set_ads_binding_active(p_id uuid,p_active boolean,p_revision integer,p_note text) returns integer
language plpgsql security definer set search_path='' as $$
declare binding public.ads_reporting_bindings%rowtype; result integer;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_active is null or p_revision is null or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Invalid access change' using errcode='22023'; end if;
 select * into binding from public.ads_reporting_bindings where id=p_id for update;
 if not found then raise exception 'Binding unavailable' using errcode='22023'; end if;
 if binding.active=p_active then return binding.revision; end if;
 if binding.revision<>p_revision then raise exception 'State changed; refresh' using errcode='40001'; end if;
 result:=binding.revision+1;
 update public.ads_reporting_bindings set active=p_active,revision=result,updated_by=auth.uid(),updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_reporting_binding',p_id,'UPDATE',jsonb_build_object('active',p_active,'revision',result,'note',btrim(p_note)));
 return result;
end $$;
create function public.share_ads_source_snapshot(p_snapshot uuid,p_binding uuid,p_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare binding public.ads_reporting_bindings%rowtype; source public.ads_reporting_snapshots%rowtype; prior public.ads_source_handoffs%rowtype; result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Source review note required' using errcode='22023'; end if;
 select * into binding from public.ads_reporting_bindings where id=p_binding for update;
 if not found or not binding.active then raise exception 'Binding inactive' using errcode='42501'; end if;
 select * into source from public.ads_reporting_snapshots where id=p_snapshot for update;
 if not found or source.account_id is distinct from binding.account_id then raise exception 'Source account mismatch' using errcode='22023'; end if;
 select * into prior from public.ads_source_handoffs where snapshot_id=p_snapshot;
 if found then
  if prior.binding_id is distinct from p_binding or prior.note is distinct from btrim(p_note) then raise exception 'Handoff already frozen' using errcode='40001'; end if;
  return prior.id;
 end if;
 insert into public.ads_source_handoffs(snapshot_id,binding_id,note,shared_by) values(p_snapshot,p_binding,btrim(p_note),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ads_source_handoff',result,'INSERT',jsonb_build_object('snapshot_id',p_snapshot,'organization_id',binding.organization_id,'source_check',source.check_status,'not_published',true,'no_ledger_posting',true));
 return result;
end $$;
create function public.list_ads_source_handoffs(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.record order by x.shared_at desc,x.id desc) from (
 select h.id,h.shared_at,jsonb_build_object('id',h.id,'snapshot_id',s.id,'organization_id',b.organization_id,
 'account_name',s.account_name,'account_id',s.account_id,'currency',s.currency,'timezone',s.timezone,'since',s.since,'until',s.until,
 'source_check',s.check_status,'daily_spend_micros',s.daily_spend_micros::text,'period_spend_micros',s.period_spend_micros::text,
 'missing_dates',s.report->'missingDates','end_boundary',s.report->>'endBoundary',
 'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d->>'date','spend_micros',d->>'spendMicros','impressions',d->>'impressions','clicks',d->>'clicks') order by d->>'date') from jsonb_array_elements(s.report->'daily') d),'[]'::jsonb),
 'source_sha256',s.report->>'rawSha256','retrieved_at',s.created_at,'shared_at',h.shared_at,'note',h.note) record
 from public.ads_source_handoffs h join public.ads_reporting_bindings b on b.id=h.binding_id
 join public.ads_reporting_snapshots s on s.id=h.snapshot_id
 where b.organization_id=p_org and b.active
 order by h.shared_at desc,h.id desc limit 20
 ) x),'[]'::jsonb);
end $$;
revoke all on function public.bind_ads_reporting_account(uuid,uuid,text),public.set_ads_binding_active(uuid,boolean,integer,text),public.share_ads_source_snapshot(uuid,uuid,text),public.list_ads_source_handoffs(uuid) from public,anon;
grant execute on function public.bind_ads_reporting_account(uuid,uuid,text),public.set_ads_binding_active(uuid,boolean,integer,text),public.share_ads_source_snapshot(uuid,uuid,text),public.list_ads_source_handoffs(uuid) to authenticated;
commit;
