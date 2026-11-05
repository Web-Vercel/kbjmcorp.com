-- Phase 2 foundation. Test locally first; bootstrap staff out-of-band, never from browser metadata.
begin;
create table public.staff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','operator')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from public,anon,authenticated;
grant select on public.staff_members to authenticated;
grant all on public.staff_members to service_role;
create policy own_staff_identity on public.staff_members for select to authenticated using(user_id=(select auth.uid()));

create function public.has_staff_access(p_roles text[] default array['admin','operator']::text[])
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(
  select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and s.role=any(p_roles)
 );
$$;
revoke all on function public.has_staff_access(text[]) from public,anon;
grant execute on function public.has_staff_access(text[]) to authenticated,service_role;

alter table public.inquiries add column converted_organization_id uuid references public.organizations(id);
alter table public.crm_contacts alter column email drop not null;
alter table public.crm_contacts add column phone_e164 text check(phone_e164 is null or phone_e164 ~ '^\+861[3-9][0-9]{9}$');
alter table public.crm_contacts add constraint crm_contact_method_required check(nullif(btrim(email),'') is not null or phone_e164 is not null);
create unique index crm_contact_inquiry_unique on public.crm_contacts(inquiry_id) where inquiry_id is not null;

create table public.inquiry_notes (
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid not null references public.inquiries(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index inquiry_notes_inquiry_created on public.inquiry_notes(inquiry_id,created_at);

alter table public.ad_accounts add column connection_status text not null default 'unverified'
 check(connection_status in ('unverified','connected','error','disconnected'));
alter table public.ad_accounts add column source_type text not null default 'manual'
 check(source_type in ('manual','file_import','api'));
alter table public.ad_accounts add column last_synced_at timestamptz;
-- One external account cannot silently become owned by two different client organizations.
create unique index ad_account_external_identity on public.ad_accounts(platform,external_id);

create table public.projects (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 ad_account_id uuid,
 name text not null check(char_length(btrim(name)) between 2 and 160),
 target_market text not null default 'undecided' check(target_market in ('undecided','north-america','europe','asia-pacific','global','other')),
 status text not null default 'briefing' check(status in ('briefing','creative','review','ready','active','paused','completed')),
 budget_amount numeric(14,2) check(budget_amount>=0),
 currency text not null default 'CAD' check(currency ~ '^[A-Z]{3}$'),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id)
);
create index projects_org_created on public.projects(organization_id,created_at desc);
create table public.ad_sync_runs (
 id uuid primary key default gen_random_uuid(),
 ad_account_id uuid not null references public.ad_accounts(id),
 source_type text not null check(source_type in ('manual','file_import','api')),
 status text not null check(status in ('queued','running','succeeded','failed')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 imported_records integer not null default 0 check(imported_records>=0),
 error_code text
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id),
 entity_type text not null, entity_id uuid not null,
 operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 changes jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index audit_events_created on public.audit_events(created_at desc);
alter table public.inquiry_notes enable row level security;
alter table public.projects enable row level security;
alter table public.ad_sync_runs enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.inquiry_notes,public.projects,public.ad_sync_runs,public.audit_events from public,anon,authenticated;
grant all on public.inquiry_notes,public.projects,public.ad_sync_runs,public.audit_events to service_role;
grant select on public.inquiries,public.crm_contacts,public.crm_opportunities,public.inquiry_notes,public.projects,public.ad_sync_runs,public.audit_events to authenticated;
grant update(status) on public.inquiries to authenticated;
grant insert(inquiry_id,author_id,body) on public.inquiry_notes to authenticated;
grant insert(name) on public.organizations to authenticated;
grant insert(organization_id,ad_account_id,name,target_market,status,budget_amount,currency,created_by) on public.projects to authenticated;
grant update(status) on public.projects to authenticated;
grant insert(organization_id,platform,external_id,label) on public.ad_accounts to authenticated;

create policy staff_inquiries on public.inquiries for select to authenticated using((select public.has_staff_access()));
create policy staff_inquiry_status on public.inquiries for update to authenticated using((select public.has_staff_access())) with check((select public.has_staff_access()));
create policy staff_organizations on public.organizations for select to authenticated using((select public.has_staff_access()));
create policy staff_new_organization on public.organizations for insert to authenticated with check((select public.has_staff_access()));
create policy staff_crm_contacts on public.crm_contacts for select to authenticated using((select public.has_staff_access()));
create policy staff_crm_opportunities on public.crm_opportunities for select to authenticated using((select public.has_staff_access()));
create policy staff_notes_read on public.inquiry_notes for select to authenticated using((select public.has_staff_access()));
create policy staff_notes_write on public.inquiry_notes for insert to authenticated with check((select public.has_staff_access()) and author_id=(select auth.uid()));
create policy member_projects on public.projects for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=projects.organization_id and m.user_id=(select auth.uid())));
create policy staff_projects_read on public.projects for select to authenticated using((select public.has_staff_access()));
create policy staff_projects_create on public.projects for insert to authenticated with check((select public.has_staff_access()) and created_by=(select auth.uid()));
create policy staff_projects_update on public.projects for update to authenticated using((select public.has_staff_access())) with check((select public.has_staff_access()));
create policy staff_accounts_read on public.ad_accounts for select to authenticated using((select public.has_staff_access()));
create policy admin_accounts_create on public.ad_accounts for insert to authenticated with check(public.has_staff_access(array['admin']::text[]));
create policy staff_sync_read on public.ad_sync_runs for select to authenticated using((select public.has_staff_access()));
create policy staff_audit_read on public.audit_events for select to authenticated using((select public.has_staff_access()));

create function public.record_business_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
 after_row jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(NEW) end;
 row_id uuid := coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id')::uuid;
begin
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),TG_TABLE_NAME,row_id,TG_OP,jsonb_build_object(
 'previous_status',before_row->>'status','status',after_row->>'status',
 'organization_id',coalesce(after_row->>'organization_id',after_row->>'converted_organization_id'),
 'connection_status',after_row->>'connection_status','role',after_row->>'role','active',after_row->>'active'));
 -- Do not copy messages, phone numbers, emails, notes, tokens or secrets into audit payloads.
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
revoke all on function public.record_business_audit() from public,anon,authenticated;
create trigger staff_identity_audit after insert or update or delete on public.staff_members for each row execute function public.record_business_audit();
create trigger inquiry_audit after update on public.inquiries for each row execute function public.record_business_audit();
create trigger note_audit after insert on public.inquiry_notes for each row execute function public.record_business_audit();
create trigger organization_audit after insert or update on public.organizations for each row execute function public.record_business_audit();
create trigger project_audit after insert or update on public.projects for each row execute function public.record_business_audit();
create trigger ad_account_audit after insert or update on public.ad_accounts for each row execute function public.record_business_audit();

create function public.convert_inquiry_to_client(p_inquiry_id uuid,p_company_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare lead public.inquiries%rowtype; organization uuid;
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_company_name is null or char_length(btrim(p_company_name)) not between 2 and 160 then raise exception 'Invalid company'; end if;
 select * into lead from public.inquiries where id=p_inquiry_id for update;
 if not found then raise exception 'Inquiry not found' using errcode='P0002'; end if;
 if lead.converted_organization_id is not null then return lead.converted_organization_id; end if;
 if lead.status='closed' then raise exception 'Closed inquiry' using errcode='22023'; end if;
 insert into public.organizations(name) values(btrim(p_company_name)) returning id into organization;
 insert into public.crm_contacts(inquiry_id,organization_id,email,phone_e164)
 values(lead.id,organization,lead.email,lead.phone_e164)
 on conflict(inquiry_id) where inquiry_id is not null do update set organization_id=excluded.organization_id;
 update public.inquiries set status='qualified',converted_organization_id=organization where id=lead.id;
 return organization;
end;
$$;
revoke all on function public.convert_inquiry_to_client(uuid,text) from public,anon;
grant execute on function public.convert_inquiry_to_client(uuid,text) to authenticated,service_role;
create function public.touch_project_timestamp() returns trigger language plpgsql set search_path='' as $$
begin NEW.updated_at=now(); return NEW; end;
$$;
revoke all on function public.touch_project_timestamp() from public,anon,authenticated;
create trigger project_timestamp before update on public.projects for each row execute function public.touch_project_timestamp();
commit;
