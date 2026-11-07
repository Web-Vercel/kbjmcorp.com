-- GENERATED: npm run db:bundle. Do not hand-edit.
-- NEW ISOLATED SUPABASE PROJECT ONLY. No customer data, Auth users or staff grants are seeded.
-- Review the selected project's name/region in the dashboard before running.
-- Run the entire file once in Supabase SQL Editor. Existing app tables cause a stop.
-- This is one atomic transaction; it does not delete or replace existing business records.
-- Do not run this after applying individual migrations or alongside Supabase CLI migrations.
-- Included source SHA256:
-- 001_initial.sql d80d8065e4c484a7300f59d2b317cb2b14de304a32dad720f35db8105a6270ee
-- 002_auth_rate_limits.sql 08246e503304b0df7fe440d729afb3c95d6333c70c569078f52a5ffe22c3e8c9
-- 003_inquiry_contacts.sql 4447f661111de32ec2b2f1a247e8d5182f203de9a7b342ec8dd94159d13c110c
-- 004_global_inquiry_market.sql f768bf6e52d4674ad7b8bc1504964caf415a9937ce75e2e56d571d47d67a5eab
-- 005_staff_crm_projects.sql ee51c24f430ee83d6a672b9c6ad7d19e30458c0086aa2c7343fa89c1f2d0f12a
-- 006_client_access.sql 015707a0aa3d268af7fae3d732d7e6ef3b338487f5e1a7276db00fba66ca4de2
-- 007_project_workflow.sql 8081f064864a2d72ab59fa4ed546d3eae9ebcb69e9e4c321c5ef1f5de005c93c
-- 008_client_billing.sql ce6a0161a65c7ba75a608935b571081a5ab3b1bcd46ff22622a771fea8e7de80
-- 009_cny_settlement.sql c55d427d52ca195fdeeff2cd3ee01a9c3384af3fbe4f92d6050c92be307aeae9
-- 010_crm_clients_contracts.sql 605680bcc2ecac8f31d78328eccfca1394a9dc11f3cd6e4900be31768e300e63
-- 011_three_party_operations.sql 4b91a8f0962c3c2dc466058b8a361d2d57d57a0710d02a4770e534fde1bc4815
-- 012_manual_bank_collections.sql ee9de382b65a3094e2a817ab64452aba2e24a0cc80ef300e7d32a5afca844ad2
-- 013_customer_applications.sql 91151489990f0fdf03212f14bb620769c8290903326df54965046bbaff7c37ad

begin;
select pg_advisory_xact_lock(187654321,130013);
do $bootstrap_guard$
begin
 if to_regclass('auth.users') is null or not exists(select 1 from pg_roles where rolname='authenticated') or not exists(select 1 from pg_roles where rolname='service_role') then
  raise exception 'Supabase Auth schema and roles required; nothing was initialized';
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ad_accounts','ad_sync_runs','audit_events','auth_rate_limits','bank_receipts','billing_fx_quotes','campaign_metrics_daily','campaigns','client_contracts','client_operating_links','client_profiles','client_topups','client_wallets','collection_accounts','crm_contacts','crm_opportunities','customer_application_history','customer_applications','customer_invites','finance_access','inquiries','inquiry_notes','memberships','monthly_ad_report_lines','monthly_ad_reports','operating_units','ops_reconciliations','ops_source_packets','organizations','project_activity','project_reviews','project_submissions','projects','service_request_messages','service_requests','staff_members','staff_unit_roles','wallet_collection_accounts','wallet_entries')) then
  raise exception 'Existing application objects detected. Stop and inspect migration history; do not overwrite';
 end if;
end;
$bootstrap_guard$;

-- START 001_initial.sql
-- Design draft. Apply only to a NEW, explicitly approved Supabase project.

-- gen_random_uuid() is built into supported PostgreSQL versions.
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null,
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','viewer')),
 primary key (organization_id,user_id)
);
create table public.inquiries (
 id uuid primary key default gen_random_uuid(),
 company text not null check(char_length(company) between 2 and 160),
 email text not null check(char_length(email)<=254),
 message text not null check(char_length(message) between 10 and 4000),
 locale text not null check(locale in ('zh','en')),
 status text not null default 'new' check(status in ('new','qualified','closed')),
 consent_at timestamptz not null, consent_version text not null,
 created_at timestamptz not null default now()
);
-- Internal CRM tables: service-role only; no client access policies.
create table public.crm_contacts (
 id uuid primary key default gen_random_uuid(),
 inquiry_id uuid references public.inquiries(id) on delete set null,
 organization_id uuid references public.organizations(id) on delete set null,
 name text, email text not null, notes text,
 created_at timestamptz not null default now()
);
create table public.crm_opportunities (
 id uuid primary key default gen_random_uuid(),
 contact_id uuid references public.crm_contacts(id) on delete set null,
 stage text not null default 'discovery' check(stage in ('discovery','proposal','won','lost')),
 estimated_value numeric(14,2) check(estimated_value>=0), currency char(3),
 created_at timestamptz not null default now()
);
create table public.ad_accounts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 platform text not null, external_id text not null, label text,
 unique(organization_id,platform,external_id),unique(id,organization_id)
);
create table public.campaigns (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 ad_account_id uuid not null, external_id text not null, name text not null,
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id),
 unique(ad_account_id,external_id),unique(id,organization_id)
);
create table public.campaign_metrics_daily (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 campaign_id uuid not null, day date not null, currency char(3) not null,
 impressions bigint not null default 0 check(impressions>=0),
 clicks bigint not null default 0 check(clicks>=0),
 spend numeric(16,4) not null default 0 check(spend>=0),
 conversions numeric(16,4) not null default 0 check(conversions>=0),
 foreign key(campaign_id,organization_id) references public.campaigns(id,organization_id),
 primary key(campaign_id,day)
);
create index memberships_user_idx on public.memberships(user_id);
create index inquiry_created_idx on public.inquiries(created_at desc);
create index campaign_org_idx on public.campaigns(organization_id);
create index metrics_org_day_idx on public.campaign_metrics_daily(organization_id,day);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.inquiries enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_metrics_daily enable row level security;
-- Explicitly revoke defaults. Only server service-role processes write business data.
revoke all on public.organizations,public.memberships,public.inquiries,public.crm_contacts,public.crm_opportunities,public.ad_accounts,public.campaigns,public.campaign_metrics_daily from anon,authenticated;
grant select on public.organizations,public.memberships,public.ad_accounts,public.campaigns,public.campaign_metrics_daily to authenticated;
grant all on public.organizations,public.memberships,public.inquiries,public.crm_contacts,public.crm_opportunities,public.ad_accounts,public.campaigns,public.campaign_metrics_daily to service_role;
create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()));
create policy member_organization on public.organizations for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=id and m.user_id=(select auth.uid())));
create policy member_accounts on public.ad_accounts for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=ad_accounts.organization_id and m.user_id=(select auth.uid())));
create policy member_campaigns on public.campaigns for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=campaigns.organization_id and m.user_id=(select auth.uid())));
create policy member_metrics on public.campaign_metrics_daily for select to authenticated using(exists(select 1 from public.memberships m where m.organization_id=campaign_metrics_daily.organization_id and m.user_id=(select auth.uid())));
-- END 001_initial.sql

-- START 002_auth_rate_limits.sql
-- Apply to the separate Supabase project after 001_initial.sql.

create table public.auth_rate_limits (
 bucket text primary key,
 window_start bigint not null,
 attempts integer not null check(attempts >= 0),
 updated_at timestamptz not null default now()
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;
grant all on public.auth_rate_limits to service_role;

-- Atomic across all configured buckets. Hashed phone buckets never store raw phone numbers.
-- A global bound also limits a distributed attack using many different numbers.
create function public.consume_auth_limits(p_keys text[], p_limits integer[], p_windows integer[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
 i integer; current_epoch bigint := floor(extract(epoch from clock_timestamp()));
 start_at bigint; current_row public.auth_rate_limits%rowtype; wait_seconds integer := 0;
begin
 if cardinality(p_keys) is null or cardinality(p_keys) < 1 or cardinality(p_keys) > 8
 or cardinality(p_keys) <> cardinality(p_limits) or cardinality(p_keys) <> cardinality(p_windows)
 then raise exception 'Invalid limit configuration'; end if;
 perform pg_advisory_xact_lock(721904831);
 for i in 1..cardinality(p_keys) loop
  if p_keys[i] is null or p_limits[i] is null or p_windows[i] is null
  or p_limits[i] < 1 or p_windows[i] < 1 or p_windows[i] > 86400
  then raise exception 'Invalid limit configuration'; end if;
  start_at := (current_epoch / p_windows[i]) * p_windows[i];
  select * into current_row from public.auth_rate_limits where bucket = p_keys[i];
  if found and current_row.window_start = start_at and current_row.attempts >= p_limits[i] then
   wait_seconds := greatest(wait_seconds, (start_at + p_windows[i] - current_epoch)::integer);
  end if;
 end loop;
 if wait_seconds > 0 then return wait_seconds; end if;
 for i in 1..cardinality(p_keys) loop
  start_at := (current_epoch / p_windows[i]) * p_windows[i];
  insert into public.auth_rate_limits as target(bucket,window_start,attempts,updated_at)
  values(p_keys[i],start_at,1,now()) on conflict(bucket) do update
  set attempts = case when target.window_start = excluded.window_start then target.attempts + 1 else 1 end,
  window_start = excluded.window_start, updated_at = now();
 end loop;
 return 0;
end;
$$;
revoke all on function public.consume_auth_limits(text[],integer[],integer[]) from public, anon, authenticated;
grant execute on function public.consume_auth_limits(text[],integer[],integer[]) to service_role;
comment on table public.auth_rate_limits is 'Server-only fixed-window abuse counters; schedule deletion of rows older than 48 hours.';
-- END 002_auth_rate_limits.sql

-- START 003_inquiry_contacts.sql
-- Mainland-China-first lead intake: phone OR email, independent of Auth accounts.

alter table public.inquiries alter column email drop not null;
alter table public.inquiries add column phone_e164 text
 check(phone_e164 is null or phone_e164 ~ '^\+861[3-9][0-9]{9}$');
alter table public.inquiries add column target_market text not null default 'undecided'
 check(target_market in ('undecided','north-america','europe','asia-pacific','other'));
alter table public.inquiries add constraint inquiry_contact_required check(
 nullif(btrim(email),'') is not null or phone_e164 is not null
);
comment on column public.inquiries.phone_e164 is 'Private inquiry follow-up contact only. Never grants Auth or organization membership.';
-- END 003_inquiry_contacts.sql

-- START 004_global_inquiry_market.sql
-- Keep UI, server validation and persisted market options aligned.

alter table public.inquiries drop constraint inquiries_target_market_check;
alter table public.inquiries add constraint inquiries_target_market_check
 check(target_market in ('undecided','north-america','europe','asia-pacific','global','other'));
-- END 004_global_inquiry_market.sql

-- START 005_staff_crm_projects.sql
-- Phase 2 foundation. Test locally first; bootstrap staff out-of-band, never from browser metadata.

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
-- END 005_staff_crm_projects.sql

-- START 006_client_access.sql
-- Verified, pre-existing Auth users only. Never look up users by a public phone number.

create policy staff_memberships_read on public.memberships for select to authenticated
 using ((select public.has_staff_access(array['admin']::text[])));
create function public.set_client_access(p_organization_id uuid,p_user_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role text;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_action is null or p_action not in ('grant_viewer','revoke') then raise exception 'Invalid action' using errcode='22023'; end if;
 -- Serialize changes for this organization, including an absent membership row.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Invalid association' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid association' using errcode='22023'; end if;
 if exists(select 1 from public.staff_members where user_id=p_user_id) then raise exception 'Staff identity cannot be assigned as client' using errcode='22023'; end if;
 select role into previous_role from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 if p_action='grant_viewer' then
  if previous_role is not null then return; end if;
  insert into public.memberships(organization_id,user_id,role) values(p_organization_id,p_user_id,'viewer');
 else
  if previous_role is null then return; end if;
  delete from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'client_access',p_organization_id,case when p_action='revoke' then 'DELETE' else 'INSERT' end,
 jsonb_build_object('organization_id',p_organization_id,'target_user_id',p_user_id,'previous_role',previous_role,'role',case when p_action='grant_viewer' then 'viewer' else null end));
end;
$$;
revoke all on function public.set_client_access(uuid,uuid,text) from public,anon;
grant execute on function public.set_client_access(uuid,uuid,text) to authenticated;
-- END 006_client_access.sql

-- START 007_project_workflow.sql
-- Versioned, shared project collaboration. No file storage or platform writes.

create function public.can_collaborate(p_organization_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where user_id=auth.uid() and organization_id=p_organization_id and role in ('owner','admin'))
 and not exists(select 1 from public.staff_members where user_id=auth.uid());
$$;
revoke all on function public.can_collaborate(uuid) from public,anon;
grant execute on function public.can_collaborate(uuid) to authenticated;

create table public.project_submissions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 kind text not null check(kind in ('brief','creative')),
 version integer not null check(version>0),
 title text not null check(char_length(btrim(title)) between 2 and 160),
 body text not null check(char_length(btrim(body)) between 10 and 1500),
 reference_url text check(reference_url is null or (char_length(reference_url)<=1000 and reference_url ~ '^https://[^[:space:]@]+$')),
 author_id uuid not null references auth.users(id),
 author_role text not null check(author_role in ('staff','client')),
 created_at timestamptz not null default now(),
 unique(project_id,kind,version)
);
create table public.project_reviews (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique references public.project_submissions(id),
 decision text not null check(decision in ('approved','changes_requested')),
 feedback text not null check(char_length(btrim(feedback)) between 2 and 1000),
 reviewer_id uuid not null references auth.users(id),
 reviewer_role text not null check(reviewer_role in ('staff','client')),
 created_at timestamptz not null default now()
);
create table public.project_activity (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id),
 event_type text not null check(event_type in ('status','submission','review','update')),
 detail text not null check(char_length(detail) between 1 and 1000),
 actor_id uuid references auth.users(id),
 actor_role text not null check(actor_role in ('staff','client','system')),
 created_at timestamptz not null default now()
);
create index project_submissions_lookup on public.project_submissions(project_id,kind,version desc);
create index project_activity_lookup on public.project_activity(project_id,created_at desc);
alter table public.project_submissions enable row level security;
alter table public.project_reviews enable row level security;
alter table public.project_activity enable row level security;
revoke all on public.project_submissions,public.project_reviews,public.project_activity from public,anon,authenticated;
grant all on public.project_submissions,public.project_reviews,public.project_activity to service_role;
-- Do not disclose staff/customer Auth identifiers in shared business records.
grant select(id,project_id,kind,version,title,body,reference_url,author_role,created_at) on public.project_submissions to authenticated;
grant select(id,submission_id,decision,feedback,reviewer_role,created_at) on public.project_reviews to authenticated;
grant select(id,project_id,event_type,detail,actor_role,created_at) on public.project_activity to authenticated;
create policy shared_submissions on public.project_submissions for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id));
create policy shared_reviews on public.project_reviews for select to authenticated using(exists(select 1 from public.project_submissions s where s.id=submission_id));
create policy shared_activity on public.project_activity for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id));

create function public.submit_project_content(p_project_id uuid,p_kind text,p_title text,p_body text,p_reference_url text,p_expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare project public.projects%rowtype; latest integer; result uuid; staff boolean := public.has_staff_access();
begin
 select * into project from public.projects where id=p_project_id for update;
 if not found or not (staff or public.can_collaborate(project.organization_id)) then raise exception 'Not available' using errcode='42501'; end if;
 if project.status='completed' then raise exception 'Project closed' using errcode='22023'; end if;
 if p_kind is null or p_kind not in ('brief','creative') or (p_kind='brief' and staff) or (p_kind='creative' and not staff) then raise exception 'Forbidden action' using errcode='42501'; end if;
 select coalesce(max(version),0) into latest from public.project_submissions where project_id=p_project_id and kind=p_kind;
 if p_expected_version is null or latest<>p_expected_version then raise exception 'Stale revision' using errcode='40001'; end if;
 if latest>=100 then raise exception 'Revision limit' using errcode='54000'; end if;
 insert into public.project_submissions(project_id,kind,version,title,body,reference_url,author_id,author_role)
 values(p_project_id,p_kind,latest+1,btrim(p_title),btrim(p_body),nullif(btrim(p_reference_url),''),auth.uid(),case when staff then 'staff' else 'client' end) returning id into result;
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
 values(p_project_id,'submission',p_kind||':'||(latest+1)::text,auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'project_submission',result,'INSERT',jsonb_build_object('project_id',p_project_id,'kind',p_kind,'version',latest+1));
 update public.projects set updated_at=now() where id=p_project_id;
 return result;
end;
$$;
create function public.review_project_content(p_project_id uuid,p_submission_id uuid,p_decision text,p_feedback text)
returns void language plpgsql security definer set search_path='' as $$
declare project public.projects%rowtype; submission public.project_submissions%rowtype; staff boolean := public.has_staff_access();
begin
 select * into project from public.projects where id=p_project_id for update;
 if not found or not (staff or public.can_collaborate(project.organization_id)) then raise exception 'Not available' using errcode='42501'; end if;
 if project.status='completed' then raise exception 'Project closed' using errcode='22023'; end if;
 select * into submission from public.project_submissions where id=p_submission_id and project_id=p_project_id;
 if not found then raise exception 'Not available' using errcode='42501'; end if;
 if (submission.kind='brief' and not staff) or (submission.kind='creative' and staff) or submission.author_id=auth.uid() then raise exception 'Forbidden action' using errcode='42501'; end if;
 if exists(select 1 from public.project_submissions where project_id=p_project_id and kind=submission.kind and version>submission.version)
 or exists(select 1 from public.project_reviews where submission_id=p_submission_id) then raise exception 'Stale revision' using errcode='40001'; end if;
 insert into public.project_reviews(submission_id,decision,feedback,reviewer_id,reviewer_role)
 values(p_submission_id,p_decision,btrim(p_feedback),auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
 values(p_project_id,'review',submission.kind||':'||submission.version::text||':'||p_decision,auth.uid(),case when staff then 'staff' else 'client' end);
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'project_review',p_submission_id,'INSERT',jsonb_build_object('project_id',p_project_id,'decision',p_decision));
 update public.projects set updated_at=now() where id=p_project_id;
end;
$$;
create function public.publish_project_update(p_project_id uuid,p_body text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 if not found then raise exception 'Project not found' using errcode='P0002'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 2 and 1000 then raise exception 'Invalid update' using errcode='22023'; end if;
 if (select count(*) from public.project_activity where project_id=p_project_id and event_type='update')>=200 then raise exception 'Update limit' using errcode='54000'; end if;
 insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role) values(p_project_id,'update',btrim(p_body),auth.uid(),'staff');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'project_update',p_project_id,'INSERT','{}'::jsonb);
 update public.projects set updated_at=now() where id=p_project_id;
end;
$$;
revoke all on function public.submit_project_content(uuid,text,text,text,text,integer),public.review_project_content(uuid,uuid,text,text),public.publish_project_update(uuid,text) from public,anon;
grant execute on function public.submit_project_content(uuid,text,text,text,text,integer),public.review_project_content(uuid,uuid,text,text),public.publish_project_update(uuid,text) to authenticated;

create function public.project_status_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if OLD.status is distinct from NEW.status then
  insert into public.project_activity(project_id,event_type,detail,actor_id,actor_role)
  values(NEW.id,'status',OLD.status||':'||NEW.status,auth.uid(),case when public.has_staff_access() then 'staff' else 'system' end);
 end if;
 return NEW;
end;
$$;
revoke all on function public.project_status_activity() from public,anon,authenticated;
create trigger project_status_history after update on public.projects for each row execute function public.project_status_activity();
create or replace function public.set_client_access(p_organization_id uuid,p_user_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_role text; next_role text;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_action is null or p_action not in ('grant_viewer','grant_contributor','revoke') then raise exception 'Invalid action' using errcode='22023'; end if;
 -- Serialize changes for this organization, including an absent membership row.
 perform 1 from public.organizations where id=p_organization_id for update;
 if not found then raise exception 'Invalid association' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid association' using errcode='22023'; end if;
 if exists(select 1 from public.staff_members where user_id=p_user_id) then raise exception 'Staff identity cannot be assigned as client' using errcode='22023'; end if;
 select role into previous_role from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 if p_action in ('grant_viewer','grant_contributor') then
  next_role := case when p_action='grant_contributor' then 'admin' else 'viewer' end;
  if previous_role='owner' or previous_role=next_role or (previous_role='admin' and next_role='viewer') then return; end if;
  insert into public.memberships(organization_id,user_id,role) values(p_organization_id,p_user_id,next_role)
  on conflict(organization_id,user_id) do update set role=excluded.role;
 else
  if previous_role is null then return; end if;
  delete from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'client_access',p_organization_id,case when p_action='revoke' then 'DELETE' when previous_role is not null then 'UPDATE' else 'INSERT' end,
 jsonb_build_object('organization_id',p_organization_id,'target_user_id',p_user_id,'previous_role',previous_role,'role',next_role));
end;
$$;
-- END 007_project_workflow.sql

-- START 008_client_billing.sql
-- Separate agency prepayment ledger. No payment gateway or provider API is enabled.

create table public.finance_access (
 organization_id uuid not null, user_id uuid not null,
 role text not null check(role in ('viewer','manager')),
 primary key(organization_id,user_id),
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table public.finance_access enable row level security;
revoke all on public.finance_access from public,anon,authenticated;
grant select on public.finance_access to authenticated;
grant select,insert,update,delete on public.finance_access to service_role;
create policy own_finance_access on public.finance_access for select to authenticated using(user_id=(select auth.uid()));
create function public.has_finance_access(p_org uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.finance_access f join public.memberships m using(organization_id,user_id)
 where f.organization_id=p_org and f.user_id=auth.uid() and (not p_write or f.role='manager'));
$$;
revoke all on function public.has_finance_access(uuid,boolean) from public,anon;
grant execute on function public.has_finance_access(uuid,boolean) to authenticated;

create table public.client_wallets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 currency text not null check(currency in ('CAD','USD','CNY','EUR','GBP','AUD')),
 created_at timestamptz not null default now(), unique(organization_id,currency), unique(id,organization_id,currency)
);
create table public.monthly_ad_reports (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 ad_account_id uuid, source_account_name text not null default '' check(char_length(source_account_name)<=160),
 month date not null check(extract(day from month)=1), version integer not null default 1 check(version>0),
 ad_spend_minor bigint not null check(ad_spend_minor>=0 and ad_spend_minor<=9999999999),
 service_fee_minor bigint not null default 0 check(service_fee_minor>=0 and service_fee_minor<=9999999999),
 source_language text not null check(source_language in ('en','zh','other')),
 translation_status text not null default 'pending' check(translation_status in ('not_needed','pending','reviewed')),
 source_filename text not null check(char_length(source_filename) between 1 and 180),
 source_timezone text not null check(char_length(source_timezone) between 1 and 80),
 -- Private object identity; never returned to customers or embedded in public URLs.
 source_storage_key text, source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 summary_zh text check(char_length(summary_zh)<=4000), summary_en text check(char_length(summary_en)<=4000),
 reviewed_by uuid references auth.users(id), published_at timestamptz,
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id),
 unique(wallet_id,month,version),
 check(published_at is null or (source_storage_key is not null and source_sha256 is not null and reviewed_by is not null and ad_account_id is not null and nullif(btrim(source_account_name),'') is not null)),
 check(published_at is null or (source_language='zh' and translation_status='not_needed') or (translation_status='reviewed' and nullif(btrim(summary_zh),'') is not null))
);
create table public.monthly_ad_report_lines (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.monthly_ad_reports(id),
 campaign text not null check(char_length(campaign) between 1 and 160), market text not null check(char_length(market) between 1 and 120),
 impressions bigint check(impressions between 0 and 9999999999999), clicks bigint check(clicks between 0 and 9999999999999), spend_minor bigint not null check(spend_minor between 0 and 9999999999)
);
create table public.client_topups (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 amount_minor bigint not null check(amount_minor between 1 and 9999999999),
 reference text not null check(char_length(btrim(reference)) between 3 and 120),
 status text not null default 'pending' check(status in ('pending','credited','rejected')),
 requested_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 unique(wallet_id,reference)
);
create table public.wallet_entries (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 kind text not null check(kind in ('topup','ad_spend','service_fee','refund','adjustment')),
 amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=9999999999),
 description text not null check(char_length(btrim(description)) between 2 and 240),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 posted_at timestamptz not null default now(),
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 unique(wallet_id,kind,source_reference),
 check((kind='topup' and amount_minor>0) or (kind in ('ad_spend','service_fee','refund') and amount_minor<0) or kind='adjustment')
);
create index wallet_entries_wallet_date on public.wallet_entries(wallet_id,posted_at desc);
create index monthly_reports_org_month on public.monthly_ad_reports(organization_id,month desc);
create index report_lines_report on public.monthly_ad_report_lines(report_id);
alter table public.client_wallets enable row level security;
alter table public.monthly_ad_reports enable row level security;
alter table public.monthly_ad_report_lines enable row level security;
alter table public.client_topups enable row level security;
alter table public.wallet_entries enable row level security;
revoke all on public.client_wallets,public.monthly_ad_reports,public.monthly_ad_report_lines,public.client_topups,public.wallet_entries from public,anon,authenticated;
grant select,insert,update,delete on public.client_wallets,public.monthly_ad_reports,public.monthly_ad_report_lines,public.client_topups to service_role;
grant select,insert on public.wallet_entries to service_role;
grant select on public.client_wallets to authenticated;
grant select(id,wallet_id,organization_id,currency,amount_minor,reference,status,created_at) on public.client_topups to authenticated;
grant select(id,wallet_id,kind,amount_minor,description,posted_at) on public.wallet_entries to authenticated;
grant select(id,wallet_id,organization_id,month,version,currency,ad_spend_minor,service_fee_minor,source_language,translation_status,source_filename,source_account_name,source_timezone,published_at,summary_zh,summary_en) on public.monthly_ad_reports to authenticated;
grant select on public.monthly_ad_report_lines to authenticated;
create policy finance_wallets on public.client_wallets for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_entries on public.wallet_entries for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_topups on public.client_topups for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_reports on public.monthly_ad_reports for select to authenticated using(published_at is not null and public.has_finance_access(organization_id));
create policy finance_report_lines on public.monthly_ad_report_lines for select to authenticated using(exists(select 1 from public.monthly_ad_reports r where r.id=report_id));

create function public.get_client_wallets() returns table(id uuid,organization_id uuid,organization_name text,currency text,balance_minor text,credited_minor text,updated_at timestamptz,can_request boolean)
language sql stable security definer set search_path='' as $$
 select w.id,w.organization_id,o.name,w.currency,coalesce(sum(e.amount_minor),0)::text,
 coalesce(sum(e.amount_minor) filter(where e.kind='topup'),0)::text,max(e.posted_at),public.has_finance_access(w.organization_id,true)
 from public.client_wallets w join public.organizations o on o.id=w.organization_id left join public.wallet_entries e on e.wallet_id=w.id
 where public.has_finance_access(w.organization_id) group by w.id,o.name;
$$;
create function public.request_client_topup(p_wallet_id uuid,p_amount_minor bigint,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.client_wallets%rowtype; result uuid;
begin
 select * into w from public.client_wallets where id=p_wallet_id for update;
 if not found or not public.has_finance_access(w.organization_id,true) then raise exception 'Forbidden' using errcode='42501'; end if;
 if (select count(*) from public.client_topups where wallet_id=p_wallet_id and status='pending')>=10 then raise exception 'Pending request limit' using errcode='54000'; end if;
 insert into public.client_topups(wallet_id,organization_id,currency,amount_minor,reference,requested_by)
 values(w.id,w.organization_id,w.currency,p_amount_minor,btrim(p_reference),auth.uid()) returning id into result;
 -- A request never credits the wallet. Settlement requires trusted verification.
 return result;
end;
$$;
revoke all on function public.get_client_wallets(),public.request_client_topup(uuid,bigint,text) from public,anon;
grant execute on function public.get_client_wallets(),public.request_client_topup(uuid,bigint,text) to authenticated;
-- Browser roles cannot post money, alter balances, settle topups or publish reports.
-- Trusted financial posting, corrections, source validation and private storage remain a separate implementation.
create function public.lock_posted_money() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Posted ledger entries are immutable; append a documented correction' using errcode='42501'; end;
$$;
revoke all on function public.lock_posted_money() from public,anon,authenticated;
create trigger immutable_money before update or delete on public.wallet_entries for each row execute function public.lock_posted_money();
create function public.protect_published_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP<>'INSERT' and OLD.published_at is not null then raise exception 'Published reports are immutable; create a new revision' using errcode='42501'; end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.published_at is not null then
  if not exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id)
   or (select coalesce(sum(spend_minor),0) from public.monthly_ad_report_lines where report_id=NEW.id)<>NEW.ad_spend_minor then
   raise exception 'Report lines must reconcile before publication' using errcode='23514';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=NEW.source_timezone) then raise exception 'Invalid source timezone' using errcode='23514'; end if;
 end if;
 return NEW;
end;
$$;
revoke all on function public.protect_published_report() from public,anon,authenticated;
create trigger protect_report before insert or update or delete on public.monthly_ad_reports for each row execute function public.protect_published_report();
create function public.protect_report_lines() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_id uuid;
begin
 if TG_OP='UPDATE' and OLD.report_id<>NEW.report_id then raise exception 'Report identity cannot change' using errcode='42501'; end if;
 parent_id := case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
 perform 1 from public.monthly_ad_reports where id=parent_id for update;
 if TG_OP<>'INSERT' and exists(select 1 from public.monthly_ad_reports where id=OLD.report_id and published_at is not null) then raise exception 'Published report lines are immutable' using errcode='42501'; end if;
 if TG_OP<>'DELETE' and exists(select 1 from public.monthly_ad_reports where id=NEW.report_id and published_at is not null) then raise exception 'Published report lines are immutable' using errcode='42501'; end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
revoke all on function public.protect_report_lines() from public,anon,authenticated;
create trigger protect_lines before insert or update or delete on public.monthly_ad_report_lines for each row execute function public.protect_report_lines();
-- END 008_client_billing.sql

-- START 009_cny_settlement.sql
-- New client settlement policy: CNY principal, CAD source spend, no automatic FX markup; agreed agency fees only.
-- Historical accounts/statements are not rewritten or converted in place.

create table public.billing_fx_quotes (
 id uuid primary key default gen_random_uuid(),
 cad_cny_rate text not null check(cad_cny_rate ~ '^[0-9]{1,6}(\.[0-9]{1,8})?$' and cad_cny_rate::numeric>0),
 value_date date not null, quoted_at timestamptz not null,
 source_name text not null check(char_length(btrim(source_name)) between 2 and 180),
 is_demo boolean not null default false
);
alter table public.billing_fx_quotes enable row level security;
revoke all on public.billing_fx_quotes from public,anon,authenticated;
grant select,insert on public.billing_fx_quotes to service_role;
grant select on public.billing_fx_quotes to authenticated;
create trigger immutable_fx_quote before update or delete on public.billing_fx_quotes for each row execute function public.lock_posted_money();
alter table public.monthly_ad_reports add column source_currency text check(source_currency is null or source_currency='CAD');
alter table public.monthly_ad_reports add column source_ad_spend_minor bigint check(source_ad_spend_minor between 0 and 9999999999);
alter table public.monthly_ad_reports add column fx_quote_id uuid references public.billing_fx_quotes(id);
alter table public.monthly_ad_reports add column settlement_date date;
alter table public.monthly_ad_reports add column fee_basis_points integer not null default 0 check(fee_basis_points between 0 and 10000);
alter table public.monthly_ad_reports add column fee_agreement_reference text check(char_length(btrim(fee_agreement_reference)) between 3 and 180);
alter table public.client_wallets alter column currency set default 'CNY';
alter table public.monthly_ad_report_lines add column source_cad_minor bigint check(source_cad_minor between 0 and 9999999999);
grant select(source_currency,source_ad_spend_minor,fx_quote_id,settlement_date,fee_basis_points,fee_agreement_reference) on public.monthly_ad_reports to authenticated;
-- A quote is visible only with a published statement the customer can read.
create policy report_fx_quote on public.billing_fx_quotes for select to authenticated using(exists(select 1 from public.monthly_ad_reports r where r.fx_quote_id=billing_fx_quotes.id));
create function public.validate_cny_statement() returns trigger language plpgsql security definer set search_path='' as $$
declare quote public.billing_fx_quotes%rowtype; converted numeric; fee numeric;
begin
 if NEW.published_at is null or NEW.currency<>'CNY' then return NEW; end if;
 if NEW.source_currency is distinct from 'CAD' or NEW.source_ad_spend_minor is null or NEW.settlement_date is null or NEW.fx_quote_id is null then raise exception 'CAD source and locked settlement quote required' using errcode='23514'; end if;
 select * into quote from public.billing_fx_quotes where id=NEW.fx_quote_id;
 if not found or quote.is_demo or quote.value_date<>NEW.settlement_date then raise exception 'Current settlement date quote required; demo rates are not publishable' using errcode='23514'; end if;
 if (quote.quoted_at at time zone 'Asia/Shanghai')::date<>NEW.settlement_date then raise exception 'Quote must be recorded on the settlement day' using errcode='23514'; end if;
 if NEW.published_at<quote.quoted_at then raise exception 'Quote must precede confirmation' using errcode='23514'; end if;
 if (NEW.published_at at time zone 'Asia/Shanghai')::date<>NEW.settlement_date then raise exception 'Confirmation day must match locked settlement day' using errcode='23514'; end if;
 if exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id and source_cad_minor is null)
 or (select coalesce(sum(source_cad_minor),0) from public.monthly_ad_report_lines where report_id=NEW.id)<>NEW.source_ad_spend_minor then raise exception 'Original CAD detail must reconcile' using errcode='23514'; end if;
 if NEW.fee_basis_points>0 and nullif(btrim(NEW.fee_agreement_reference),'') is null then raise exception 'Agreed fee evidence required' using errcode='23514'; end if;
 converted := round(NEW.source_ad_spend_minor::numeric*quote.cad_cny_rate::numeric,0);
 fee := round(converted*NEW.fee_basis_points/10000,0);
 if NEW.ad_spend_minor<>converted or NEW.service_fee_minor<>fee then raise exception 'CNY amount or agreed fee mismatch' using errcode='23514'; end if;
 if exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id and (spend_minor<floor(source_cad_minor::numeric*quote.cad_cny_rate::numeric) or spend_minor>ceil(source_cad_minor::numeric*quote.cad_cny_rate::numeric))) then raise exception 'Converted line allocation mismatch' using errcode='23514'; end if;
 return NEW;
end;
$$;
revoke all on function public.validate_cny_statement() from public,anon,authenticated;
create trigger validate_cny_fx before insert or update on public.monthly_ad_reports for each row execute function public.validate_cny_statement();
-- END 009_cny_settlement.sql

-- START 010_crm_clients_contracts.sql
-- Single-agency CRM: business records, explicit phone invitations and contract register.

create table public.client_profiles (
 organization_id uuid primary key references public.organizations(id),
 legal_name text not null check(char_length(btrim(legal_name)) between 2 and 160),
 registration_number text check(char_length(registration_number)<=80),
 country text not null check(country ~ '^[A-Z]{2}$'),
 website text check(website is null or (char_length(website)<=500 and website ~ '^https://[^[:space:]@]+$')),
 industry text not null default '' check(char_length(industry)<=100),
 status text not null default 'prospect' check(status in ('prospect','onboarding','active','paused','closed')),
 internal_notes text not null default '' check(char_length(internal_notes)<=2000),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index client_registration_unique on public.client_profiles(country,registration_number) where nullif(registration_number,'') is not null;
alter table public.crm_contacts add column title text not null default '' check(char_length(title)<=100);
alter table public.crm_contacts add column contact_kind text not null default 'business' check(contact_kind in ('business','finance','legal'));
alter table public.crm_contacts add column archived boolean not null default false;
alter table public.crm_contacts drop constraint if exists crm_contacts_phone_e164_check;
alter table public.crm_contacts add constraint crm_phone_format check(phone_e164 is null or (phone_e164 ~ '^\+[1-9][0-9]{6,14}$' and (phone_e164 not like '+86%' or phone_e164 ~ '^\+861[3-9][0-9]{9}$')));
alter table public.crm_contacts add constraint crm_contact_org_identity unique(id,organization_id);

create table public.customer_invites (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 contact_id uuid not null, phone_e164 text not null check(phone_e164 ~ '^\+861[3-9][0-9]{9}$'),
 business_role text not null check(business_role in ('viewer','admin')),
 finance_role text not null check(finance_role in ('none','viewer','manager')),
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 160),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 expires_at timestamptz not null, accepted_by uuid references auth.users(id), accepted_at timestamptz,
 foreign key(contact_id,organization_id) references public.crm_contacts(id,organization_id)
);
create unique index pending_customer_invite on public.customer_invites(organization_id,phone_e164) where status='pending';
create index pending_invite_phone on public.customer_invites(phone_e164,expires_at) where status='pending';
create index crm_contacts_organization on public.crm_contacts(organization_id);
create table public.client_contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 template_version text not null default 'agency-draft-v1', template_body text not null check(char_length(template_body) between 20 and 18000), title text not null check(char_length(btrim(title)) between 2 and 160),
 client_legal_name text not null, provider_legal_name text not null check(char_length(btrim(provider_legal_name)) between 2 and 160),
 service_scope text not null check(char_length(btrim(service_scope)) between 10 and 1500),
 pricing_terms text not null check(char_length(btrim(pricing_terms)) between 10 and 1500),
 refund_terms text not null check(char_length(btrim(refund_terms)) between 10 and 1000),
 starts_on date not null, ends_on date not null check(ends_on>=starts_on),
 status text not null default 'draft' check(status in ('draft','sent','signed','expired','terminated')),
 client_visible boolean not null default false,
 signature_reference text check(char_length(signature_reference)<=180), signed_on date,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'draft' or not client_visible),
 check(status<>'signed' or (signed_on is not null and char_length(btrim(signature_reference)) between 3 and 180))
);
create index client_contracts_organization on public.client_contracts(organization_id,created_at desc);
alter table public.client_profiles enable row level security;
alter table public.customer_invites enable row level security;
alter table public.client_contracts enable row level security;
revoke all on public.client_profiles,public.customer_invites,public.client_contracts from public,anon,authenticated;
grant select,insert,update,delete on public.client_profiles,public.customer_invites,public.client_contracts to service_role;
grant select on public.client_profiles,public.customer_invites to authenticated;
grant select(id,organization_id,template_version,template_body,title,client_legal_name,provider_legal_name,service_scope,pricing_terms,refund_terms,starts_on,ends_on,status,client_visible,signature_reference,signed_on,created_at,updated_at) on public.client_contracts to authenticated;
create policy staff_client_profiles on public.client_profiles for select to authenticated using((select public.has_staff_access()));
create policy admin_customer_invites on public.customer_invites for select to authenticated using(public.has_staff_access(array['admin']::text[]));
create policy admin_contracts on public.client_contracts for select to authenticated using(public.has_staff_access(array['admin']::text[]));
-- Contract prices/terms are financial information, not automatically visible to every project viewer.
create policy client_visible_contracts on public.client_contracts for select to authenticated using(client_visible and status<>'draft' and public.has_finance_access(organization_id));

create function public.save_crm_client(p_organization_id uuid,p_name text,p_legal_name text,p_registration text,p_country text,p_website text,p_industry text,p_status text,p_notes text,p_revision integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; current_revision integer;
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 2 and 160 then raise exception 'Invalid name' using errcode='22023'; end if;
 if p_organization_id is null then
  insert into public.organizations(name) values(btrim(p_name)) returning id into org;
 else
  org:=p_organization_id;
  perform 1 from public.organizations where id=org for update;
  if not found then raise exception 'Client not found' using errcode='P0002'; end if;
  select revision into current_revision from public.client_profiles where organization_id=org;
  if p_revision is null or coalesce(current_revision,0)<>p_revision then raise exception 'Stale client revision' using errcode='40001'; end if;
  update public.organizations set name=btrim(p_name) where id=org;
 end if;
 insert into public.client_profiles(organization_id,legal_name,registration_number,country,website,industry,status,internal_notes)
 values(org,btrim(p_legal_name),nullif(btrim(p_registration),''),p_country,nullif(btrim(p_website),''),btrim(p_industry),p_status,btrim(p_notes))
 on conflict(organization_id) do update set legal_name=excluded.legal_name,registration_number=excluded.registration_number,country=excluded.country,website=excluded.website,industry=excluded.industry,status=excluded.status,internal_notes=excluded.internal_notes,revision=client_profiles.revision+1,updated_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_profile',org,case when p_organization_id is null then 'INSERT' else 'UPDATE' end,jsonb_build_object('status',p_status));
 return org;
end;
$$;
create function public.save_crm_contact(p_organization_id uuid,p_contact_id uuid,p_name text,p_title text,p_phone text,p_email text,p_kind text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then raise exception 'Invalid contact' using errcode='22023'; end if;
 if p_contact_id is null then
  insert into public.crm_contacts(organization_id,name,title,phone_e164,email,contact_kind) values(p_organization_id,btrim(p_name),btrim(p_title),nullif(p_phone,''),nullif(p_email,''),p_kind) returning id into result;
 else
  update public.crm_contacts set name=btrim(p_name),title=btrim(p_title),phone_e164=nullif(p_phone,''),email=nullif(p_email,''),contact_kind=p_kind where id=p_contact_id and organization_id=p_organization_id returning id into result;
  if result is null then raise exception 'Contact not found' using errcode='P0002'; end if;
  -- A changed contact identity invalidates its unclaimed authorization.
  update public.customer_invites set status='revoked' where contact_id=result and status='pending' and phone_e164 is distinct from nullif(p_phone,'');
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_contact',result,case when p_contact_id is null then 'INSERT' else 'UPDATE' end,jsonb_build_object('organization_id',p_organization_id));
 return result;
end;
$$;
create function public.invite_crm_contact(p_organization_id uuid,p_contact_id uuid,p_business_role text,p_finance_role text,p_evidence text)
returns uuid language plpgsql security definer set search_path='' as $$
declare contact public.crm_contacts%rowtype; result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_organization_id for update;
 if not exists(select 1 from public.client_profiles where organization_id=p_organization_id and status<>'closed') then raise exception 'Complete an open client profile first' using errcode='22023'; end if;
 select * into contact from public.crm_contacts where id=p_contact_id and organization_id=p_organization_id for update;
 if not found or contact.archived or nullif(btrim(contact.name),'') is null or contact.phone_e164 is null or contact.phone_e164 !~ '^\+861[3-9][0-9]{9}$' then raise exception 'Mainland contact required' using errcode='22023'; end if;
 if p_business_role not in ('viewer','admin') or p_finance_role not in ('none','viewer','manager') then raise exception 'Invalid access' using errcode='22023'; end if;
 update public.customer_invites set status='revoked' where organization_id=p_organization_id and phone_e164=contact.phone_e164 and status='pending';
 insert into public.customer_invites(organization_id,contact_id,phone_e164,business_role,finance_role,evidence_reference,created_by,expires_at)
 values(p_organization_id,p_contact_id,contact.phone_e164,p_business_role,p_finance_role,btrim(p_evidence),auth.uid(),now()+interval '7 days') returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'customer_invite',result,'INSERT',jsonb_build_object('organization_id',p_organization_id,'business_role',p_business_role,'finance_role',p_finance_role));
 return result;
end;
$$;
create function public.claim_crm_invites() returns integer language plpgsql security definer set search_path='' as $$
declare verified_phone text; invitation public.customer_invites%rowtype; claimed integer:=0;
begin
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) then return 0; end if;
 select '+'||ltrim(phone,'+') into verified_phone from auth.users where id=auth.uid() and phone_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now());
 if verified_phone is null then return 0; end if;
 if (select count(*) from auth.users where phone in (verified_phone,ltrim(verified_phone,'+')) and phone_confirmed_at is not null and deleted_at is null)<>1 then return 0; end if;
 for invitation in select * from public.customer_invites where phone_e164=verified_phone and status='pending' and expires_at>now() order by organization_id for update loop
  if not exists(select 1 from public.staff_members where user_id=invitation.created_by and active and role='admin') then continue; end if;
  if not exists(select 1 from public.client_profiles where organization_id=invitation.organization_id and status<>'closed') then continue; end if;
  if not exists(select 1 from public.crm_contacts where id=invitation.contact_id and organization_id=invitation.organization_id and not archived and phone_e164=verified_phone) then continue; end if;
  insert into public.memberships(organization_id,user_id,role) values(invitation.organization_id,auth.uid(),invitation.business_role)
  on conflict(organization_id,user_id) do update set role=excluded.role;
  if invitation.finance_role='none' then delete from public.finance_access where organization_id=invitation.organization_id and user_id=auth.uid();
  else insert into public.finance_access(organization_id,user_id,role) values(invitation.organization_id,auth.uid(),invitation.finance_role) on conflict(organization_id,user_id) do update set role=excluded.role; end if;
  update public.customer_invites set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invitation.id;
  insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'customer_invite_claim',invitation.id,'UPDATE',jsonb_build_object('organization_id',invitation.organization_id,'business_role',invitation.business_role,'finance_role',invitation.finance_role));
  claimed:=claimed+1;
 end loop;
 return claimed;
end;
$$;
create function public.revoke_crm_access(p_organization_id uuid,p_user_id uuid,p_invite_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_invite_id is not null then update public.customer_invites set status='revoked' where id=p_invite_id and organization_id=p_organization_id and status='pending'; end if;
 if p_user_id is not null then
  update public.customer_invites set status='revoked' where organization_id=p_organization_id and (accepted_by=p_user_id or contact_id in(select contact_id from public.customer_invites where organization_id=p_organization_id and accepted_by=p_user_id));
  delete from public.memberships where organization_id=p_organization_id and user_id=p_user_id;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_access',p_organization_id,'UPDATE',jsonb_build_object('target_user_id',p_user_id,'invitation_id',p_invite_id,'action','revoke'));
end;
$$;
create function public.set_crm_finance_access(p_organization_id uuid,p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_role is null or p_role not in ('none','viewer','manager') or not exists(select 1 from public.memberships where organization_id=p_organization_id and user_id=p_user_id) or exists(select 1 from public.staff_members where user_id=p_user_id) then raise exception 'Invalid member' using errcode='22023'; end if;
 if p_role='none' then delete from public.finance_access where organization_id=p_organization_id and user_id=p_user_id;
 else insert into public.finance_access(organization_id,user_id,role) values(p_organization_id,p_user_id,p_role) on conflict(organization_id,user_id) do update set role=excluded.role; end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'finance_access',p_organization_id,'UPDATE',jsonb_build_object('target_user_id',p_user_id,'role',p_role));
end;
$$;
create function public.invalidate_pending_crm_access() returns trigger language plpgsql security definer set search_path='' as $$
declare current_phone text;
begin
 select '+'||ltrim(phone,'+') into current_phone from auth.users where id=OLD.user_id;
 update public.customer_invites set status='revoked' where organization_id=OLD.organization_id and status='pending' and
 (phone_e164=current_phone or contact_id in(select contact_id from public.customer_invites where organization_id=OLD.organization_id and accepted_by=OLD.user_id));
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
revoke all on function public.invalidate_pending_crm_access() from public,anon,authenticated;
create trigger revoke_pending_membership after delete on public.memberships for each row execute function public.invalidate_pending_crm_access();
create trigger revoke_pending_finance after update or delete on public.finance_access for each row execute function public.invalidate_pending_crm_access();

create function public.create_crm_contract(p_organization_id uuid,p_title text,p_provider text,p_scope text,p_pricing text,p_refund text,p_starts date,p_ends date,p_template_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; legal text;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 select legal_name into legal from public.client_profiles where organization_id=p_organization_id;
 if not found then raise exception 'Complete legal client profile first' using errcode='22023'; end if;
 insert into public.client_contracts(organization_id,title,client_legal_name,provider_legal_name,service_scope,pricing_terms,refund_terms,starts_on,ends_on,created_by,template_body)
 values(p_organization_id,btrim(p_title),legal,btrim(p_provider),btrim(p_scope),btrim(p_pricing),btrim(p_refund),p_starts,p_ends,auth.uid(),p_template_body) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_contract',result,'INSERT',jsonb_build_object('organization_id',p_organization_id,'status','draft'));
 return result;
end;
$$;
create function public.update_crm_contract(p_contract_id uuid,p_status text,p_client_visible boolean,p_signature_reference text,p_signed_on date,p_expected_status text)
returns void language plpgsql security definer set search_path='' as $$
declare previous public.client_contracts%rowtype;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into previous from public.client_contracts where id=p_contract_id for update;
 if not found then raise exception 'Contract not found' using errcode='P0002'; end if;
 if previous.status is distinct from p_expected_status then raise exception 'Stale contract status' using errcode='40001'; end if;
 if p_status<>previous.status and not ((previous.status='draft' and p_status='sent') or (previous.status='sent' and p_status in ('signed','terminated','expired')) or (previous.status='signed' and p_status in ('terminated','expired'))) then raise exception 'Invalid contract transition' using errcode='22023'; end if;
 if p_status='signed' and (p_signed_on is null or p_signed_on>(now() at time zone 'Asia/Shanghai')::date or p_signed_on>previous.ends_on or char_length(btrim(coalesce(p_signature_reference,''))) not between 3 and 180) then raise exception 'External signature evidence required' using errcode='22023'; end if;
 update public.client_contracts set status=p_status,client_visible=p_client_visible,signature_reference=case when previous.status in ('signed','expired','terminated') then previous.signature_reference else nullif(btrim(p_signature_reference),'') end,signed_on=case when previous.status in ('signed','expired','terminated') then previous.signed_on else p_signed_on end,updated_at=now() where id=p_contract_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_contract',p_contract_id,'UPDATE',jsonb_build_object('organization_id',previous.organization_id,'previous_status',previous.status,'status',p_status,'client_visible',p_client_visible));
end;
$$;
create function public.protect_issued_contract() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and NEW.status<>OLD.status and not ((OLD.status='draft' and NEW.status='sent') or (OLD.status='sent' and NEW.status in ('signed','terminated','expired')) or (OLD.status='signed' and NEW.status in ('terminated','expired'))) then raise exception 'Invalid contract transition' using errcode='22023'; end if;
 if OLD.status<>'draft' then
  if TG_OP='DELETE' then raise exception 'Issued contract is immutable' using errcode='42501'; end if;
  if (to_jsonb(OLD)-array['status','client_visible','signature_reference','signed_on','updated_at']) is distinct from (to_jsonb(NEW)-array['status','client_visible','signature_reference','signed_on','updated_at']) then raise exception 'Issued contract terms are immutable' using errcode='42501'; end if;
  if OLD.status in ('signed','expired','terminated') and (OLD.signature_reference is distinct from NEW.signature_reference or OLD.signed_on is distinct from NEW.signed_on) then raise exception 'Signature record is immutable' using errcode='42501'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
revoke all on function public.protect_issued_contract() from public,anon,authenticated;
create trigger protect_issued_contract before update or delete on public.client_contracts for each row execute function public.protect_issued_contract();

create function public.get_my_company_profiles() returns table(id uuid,name text,legal_name text,registration_number text,country text,website text,status text)
language sql stable security definer set search_path='' as $$
 select o.id,o.name,p.legal_name,p.registration_number,p.country,p.website,p.status from public.organizations o
 join public.memberships m on m.organization_id=o.id and m.user_id=auth.uid() left join public.client_profiles p on p.organization_id=o.id;
$$;
create function public.get_crm_finance_summary(p_organization_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'currency',w.currency,'balance_minor',coalesce((select sum(amount_minor) from public.wallet_entries e where e.wallet_id=w.id),0)::text,'pending_topups',(select count(*) from public.client_topups t where t.wallet_id=w.id and t.status='pending'))) from public.client_wallets w where w.organization_id=p_organization_id),'[]'::jsonb);
end;
$$;
create function public.open_crm_wallet(p_organization_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.client_wallets(organization_id,currency) values(p_organization_id,'CNY') on conflict(organization_id,currency) do nothing returning id into result;
 if result is not null then insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'crm_wallet',result,'INSERT',jsonb_build_object('organization_id',p_organization_id));
 else select id into result from public.client_wallets where organization_id=p_organization_id and currency='CNY'; end if;
 return result;
end;
$$;
create function public.get_crm_members(p_organization_id uuid) returns table(user_id uuid,business_role text,finance_role text,phone_hint text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 return query select m.user_id,m.role,coalesce(f.role,'none'),case when u.phone is null then '—' else left(u.phone,5)||'****'||right(u.phone,4) end from public.memberships m left join public.finance_access f using(organization_id,user_id) join auth.users u on u.id=m.user_id where m.organization_id=p_organization_id;
end;
$$;
revoke all on function public.get_crm_members(uuid) from public,anon;
grant execute on function public.get_crm_members(uuid) to authenticated;
revoke all on function public.save_crm_client(uuid,text,text,text,text,text,text,text,text,integer),public.save_crm_contact(uuid,uuid,text,text,text,text,text),public.invite_crm_contact(uuid,uuid,text,text,text),public.claim_crm_invites(),public.revoke_crm_access(uuid,uuid,uuid),public.set_crm_finance_access(uuid,uuid,text),public.create_crm_contract(uuid,text,text,text,text,text,date,date,text),public.update_crm_contract(uuid,text,boolean,text,date,text),public.get_my_company_profiles(),public.get_crm_finance_summary(uuid),public.open_crm_wallet(uuid) from public,anon;
grant execute on function public.save_crm_client(uuid,text,text,text,text,text,text,text,text,integer),public.save_crm_contact(uuid,uuid,text,text,text,text,text),public.invite_crm_contact(uuid,uuid,text,text,text),public.claim_crm_invites(),public.revoke_crm_access(uuid,uuid,uuid),public.set_crm_finance_access(uuid,uuid,text),public.create_crm_contract(uuid,text,text,text,text,text,date,date,text),public.update_crm_contract(uuid,text,boolean,text,date,text),public.get_my_company_profiles(),public.get_crm_finance_summary(uuid),public.open_crm_wallet(uuid) to authenticated;
create function public.close_crm_pending_invites() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.status='closed' then update public.customer_invites set status='revoked' where organization_id=NEW.organization_id and status='pending'; end if;
 return NEW;
end;
$$;
revoke all on function public.close_crm_pending_invites() from public,anon,authenticated;
create trigger close_crm_pending after update on public.client_profiles for each row execute function public.close_crm_pending_invites();
-- END 010_crm_clients_contracts.sql

-- START 011_three_party_operations.sql
-- Operating roles are application responsibilities, not verified legal entities or media credentials.

create table public.operating_units (
 code text primary key, label text not null, country text not null, kind text not null check(kind in ('fulfilment','market')),
 active boolean not null default true
);
insert into public.operating_units(code,label,country,kind) values('kbjm_ca','KBJM · Canada fulfilment','CA','fulfilment'),('zhidian_cn','智点未来 · China market operations','CN','market');
create table public.staff_unit_roles (
 user_id uuid not null references public.staff_members(user_id), unit_code text not null references public.operating_units(code),
 role text not null check(role in ('ad_operations','customer_service','finance_preparer','finance_reviewer')),
 active boolean not null default true, assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(),
 primary key(user_id,unit_code,role),
 check((unit_code='kbjm_ca' and role='ad_operations') or (unit_code='zhidian_cn' and role in ('customer_service','finance_preparer','finance_reviewer')))
);
create table public.client_operating_links (
 organization_id uuid primary key references public.organizations(id),
 fulfilment_unit text not null default 'kbjm_ca' references public.operating_units(code),
 market_unit text not null default 'zhidian_cn' references public.operating_units(code),
 check(fulfilment_unit='kbjm_ca' and market_unit='zhidian_cn')
);
insert into public.client_operating_links(organization_id) select id from public.organizations;
create function public.link_default_operating_units() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.client_operating_links(organization_id) values(NEW.id); return NEW; end;
$$;
revoke all on function public.link_default_operating_units() from public,anon,authenticated;
create trigger link_operating_units after insert on public.organizations for each row execute function public.link_default_operating_units();
alter table public.operating_units enable row level security;
alter table public.staff_unit_roles enable row level security;
alter table public.client_operating_links enable row level security;
revoke all on public.operating_units,public.staff_unit_roles,public.client_operating_links from public,anon,authenticated;
grant select on public.operating_units,public.staff_unit_roles to authenticated;
grant select,insert,update,delete on public.operating_units,public.staff_unit_roles,public.client_operating_links to service_role;
create policy staff_operating_units on public.operating_units for select to authenticated using(exists(select 1 from public.staff_members where user_id=auth.uid() and active));
create policy own_operating_roles on public.staff_unit_roles for select to authenticated using(user_id=auth.uid());

create function public.has_ops_capability(p_cap text,p_org uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and
 (s.role='admin' or (s.role='operator' and exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code
 where r.user_id=s.user_id and r.active and u.active and
 ((p_cap in ('source.read','source.submit','account.link') and r.role='ad_operations')
 or (p_cap='finance.read' and r.role in ('finance_preparer','finance_reviewer'))
 or (p_cap='finance.prepare' and r.role='finance_preparer') or (p_cap='finance.review' and r.role='finance_reviewer')
 or (p_cap='support.handle' and r.role='customer_service') or (p_cap='client.read'))
 and (p_org is null or exists(select 1 from public.client_operating_links l where l.organization_id=p_org and
 ((u.kind='fulfilment' and l.fulfilment_unit=u.code) or (u.kind='market' and l.market_unit=u.code))))))));
$$;
revoke all on function public.has_ops_capability(text,uuid) from public,anon;
grant execute on function public.has_ops_capability(text,uuid) to authenticated;
-- Compatibility for the original China CRM: unassigned or Canadian operators get no legacy CRM rights.
create or replace function public.has_staff_access(p_roles text[] default array['admin','operator']::text[]) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and s.role=any(p_roles)
 and (s.role='admin' or exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code where r.user_id=s.user_id and r.active and u.active and r.unit_code='zhidian_cn' and r.role='customer_service')));
$$;
create policy ops_organizations on public.organizations for select to authenticated using(public.has_ops_capability('client.read',id));
create policy canada_accounts on public.ad_accounts for select to authenticated using(public.has_ops_capability('source.read',organization_id));
create policy finance_accounts on public.ad_accounts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_wallets on public.client_wallets for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_entries on public.wallet_entries for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_topups on public.client_topups for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_reports on public.monthly_ad_reports for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_contracts on public.client_contracts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy finance_rate_sources on public.billing_fx_quotes for select to authenticated using(public.has_ops_capability('finance.read'));

create function public.get_ops_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('owner',public.has_staff_access(array['admin']::text[]),'roles',coalesce((select jsonb_agg(jsonb_build_object('unit',r.unit_code,'role',r.role)) from public.staff_unit_roles r join public.staff_members s on s.user_id=r.user_id join public.operating_units u on u.code=r.unit_code where r.user_id=auth.uid() and r.active and s.active and u.active and coalesce(auth.jwt()->>'aal','')='aal2'),'[]'::jsonb),
 'canSource',public.has_ops_capability('source.submit'),'canPrepare',public.has_ops_capability('finance.prepare'),'canReview',public.has_ops_capability('finance.review'),'canSupport',public.has_ops_capability('support.handle'));
$$;
create function public.assign_operating_role(p_user uuid,p_unit text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.staff_members where user_id=p_user and active and role='operator') then raise exception 'Existing active staff operator required' using errcode='22023'; end if;
 insert into public.staff_unit_roles(user_id,unit_code,role,active,assigned_by) values(p_user,p_unit,p_role,p_active,auth.uid()) on conflict(user_id,unit_code,role) do update set active=excluded.active,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'operating_role',p_user,'UPDATE',jsonb_build_object('unit',p_unit,'role',p_role,'active',p_active));
end;
$$;
create function public.list_operating_staff() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',s.user_id,'role',s.role,'active',s.active,'assignments',coalesce((select jsonb_agg(jsonb_build_object('unit',r.unit_code,'role',r.role,'active',r.active)) from public.staff_unit_roles r where r.user_id=s.user_id),'[]'::jsonb))) from public.staff_members s),'[]'::jsonb);
end;
$$;
create function public.ops_link_account(p_org uuid,p_external_id text,p_label text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_ops_capability('account.link',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 if char_length(btrim(p_external_id)) not between 1 and 160 or p_external_id !~ '^[a-zA-Z0-9._:-]+$' then raise exception 'Invalid account identity' using errcode='22023'; end if;
 insert into public.ad_accounts(organization_id,platform,external_id,label) values(p_org,'openai_ads',p_external_id,btrim(p_label)) returning id into result;
 return result;
end;
$$;
create table public.ops_source_packets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 ad_account_id uuid not null, period date not null check(extract(day from period)=1), version integer not null,
 source_currency text not null check(source_currency in ('CAD','USD')), source_timezone text not null check(char_length(source_timezone) between 1 and 80), source_language text not null check(source_language in ('en','zh','other')),
 source_amount_minor bigint not null check(source_amount_minor between 0 and 9999999999),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 180),
 source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'submitted' check(status in ('submitted','needs_correction','under_review','ready_for_publication','superseded')),
 source_feedback text not null default '' check(char_length(source_feedback)<=1000),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id), unique(ad_account_id,period,version)
);
create table public.ops_reconciliations (
 id uuid primary key default gen_random_uuid(), packet_id uuid not null references public.ops_source_packets(id), revision integer not null,
 fx_quote_id uuid not null references public.billing_fx_quotes(id), settlement_date date not null,
 ad_spend_cny_minor bigint not null check(ad_spend_cny_minor between 0 and 9999999999),
 fee_minor bigint not null check(fee_minor between 0 and 9999999999), fee_basis_points integer not null check(fee_basis_points between 0 and 10000),
 fee_agreement_reference text check(char_length(fee_agreement_reference)<=180),
 status text not null default 'pending' check(status in ('pending','approved','rejected','superseded')),
 prepared_by uuid not null references auth.users(id), prepared_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text check(char_length(review_note)<=1000),
 check(reviewed_by is null or reviewed_by<>prepared_by), unique(packet_id,revision)
);
alter table public.ops_source_packets enable row level security;
alter table public.ops_reconciliations enable row level security;
revoke all on public.ops_source_packets,public.ops_reconciliations from public,anon,authenticated;
grant select(id,organization_id,ad_account_id,period,version,source_currency,source_timezone,source_language,source_amount_minor,source_reference,source_sha256,status,source_feedback,submitted_at) on public.ops_source_packets to authenticated;
grant select(id,packet_id,revision,fx_quote_id,settlement_date,ad_spend_cny_minor,fee_minor,fee_basis_points,fee_agreement_reference,status,prepared_by,prepared_at,reviewed_at,review_note) on public.ops_reconciliations to authenticated;
grant select,insert,update on public.ops_source_packets,public.ops_reconciliations to service_role;
create policy source_handoff_read on public.ops_source_packets for select to authenticated using(public.has_ops_capability('source.read',organization_id) or public.has_ops_capability('finance.read',organization_id));
create policy finance_handoff_read on public.ops_reconciliations for select to authenticated using(exists(select 1 from public.ops_source_packets p where p.id=packet_id and public.has_ops_capability('finance.read',p.organization_id)));
create index ops_packet_org_date on public.ops_source_packets(organization_id,period desc);
create function public.submit_ops_source(p_org uuid,p_account uuid,p_period date,p_currency text,p_amount bigint,p_reference text,p_hash text,p_timezone text,p_language text) returns uuid language plpgsql security definer set search_path='' as $$
declare next_version integer; result uuid;
begin
 if not public.has_ops_capability('source.submit',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=p_account and organization_id=p_org for update;
 if not found then raise exception 'Account ownership mismatch' using errcode='22023'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid source timezone' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into next_version from public.ops_source_packets where ad_account_id=p_account and period=p_period;
 if next_version>100 then raise exception 'Revision limit' using errcode='54000'; end if;
 insert into public.ops_source_packets(organization_id,ad_account_id,period,version,source_currency,source_timezone,source_language,source_amount_minor,source_reference,source_sha256,submitted_by) values(p_org,p_account,p_period,next_version,p_currency,p_timezone,p_language,p_amount,btrim(p_reference),nullif(p_hash,''),auth.uid()) returning id into result;
 update public.ops_reconciliations set status='superseded',reviewed_at=now(),review_note='Source superseded by a newer revision' where status='pending' and packet_id in(select id from public.ops_source_packets where ad_account_id=p_account and period=p_period and version<next_version);
 update public.ops_source_packets set status='superseded' where ad_account_id=p_account and period=p_period and version<next_version;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_source',result,'INSERT',jsonb_build_object('organization_id',p_org,'version',next_version));
 return result;
end;
$$;
create function public.return_ops_source(p_packet uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare packet public.ops_source_packets%rowtype;
begin
 select * into packet from public.ops_source_packets where id=p_packet for update;
 if not found or not public.has_ops_capability('finance.read',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if packet.status not in ('submitted','needs_correction') then raise exception 'Source already under financial review' using errcode='40001'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 1000 then raise exception 'Source feedback required' using errcode='22023'; end if;
 update public.ops_source_packets set status='needs_correction',source_feedback=btrim(p_reason) where id=p_packet;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_source',p_packet,'UPDATE',jsonb_build_object('status','needs_correction'));
end;
$$;
create function public.prepare_ops_reconciliation(p_packet uuid,p_quote uuid,p_fee_bps integer,p_fee_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare packet public.ops_source_packets%rowtype; quote public.billing_fx_quotes%rowtype; result uuid; next_revision integer; converted numeric;
begin
 select * into packet from public.ops_source_packets where id=p_packet;
 if not found or not public.has_ops_capability('finance.prepare',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=packet.ad_account_id for update;
 select * into packet from public.ops_source_packets where id=p_packet for update;
 if exists(select 1 from public.ops_source_packets where ad_account_id=packet.ad_account_id and period=packet.period and version>packet.version) or packet.status not in ('submitted','under_review') then raise exception 'Stale or returned source' using errcode='40001'; end if;
 if packet.source_currency<>'CAD' then raise exception 'Verified CAD to CNY adapter required' using errcode='22023'; end if;
 select * into quote from public.billing_fx_quotes where id=p_quote;
 if not found or quote.is_demo or quote.value_date<>(now() at time zone 'Asia/Shanghai')::date or (quote.quoted_at at time zone 'Asia/Shanghai')::date<>quote.value_date or quote.quoted_at>now() then raise exception 'Current verified quote required' using errcode='22023'; end if;
 if p_fee_bps is null or p_fee_bps not between 0 and 10000 or (p_fee_bps>0 and char_length(btrim(coalesce(p_fee_reference,'')))<3) then raise exception 'Agreed fee evidence required' using errcode='22023'; end if;
 if exists(select 1 from public.ops_reconciliations where packet_id=p_packet and status in ('pending','approved')) then raise exception 'Financial review already exists' using errcode='40001'; end if;
 select coalesce(max(revision),0)+1 into next_revision from public.ops_reconciliations where packet_id=p_packet;
 converted:=round(packet.source_amount_minor::numeric*quote.cad_cny_rate::numeric,0);
 insert into public.ops_reconciliations(packet_id,revision,fx_quote_id,settlement_date,ad_spend_cny_minor,fee_minor,fee_basis_points,fee_agreement_reference,prepared_by) values(p_packet,next_revision,p_quote,quote.value_date,converted,round(converted*p_fee_bps/10000,0),p_fee_bps,nullif(btrim(p_fee_reference),''),auth.uid()) returning id into result;
 update public.ops_source_packets set status='under_review' where id=p_packet;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_reconciliation',result,'INSERT',jsonb_build_object('packet_id',p_packet,'revision',next_revision));
 return result;
end;
$$;
create function public.review_ops_reconciliation(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare reconciliation public.ops_reconciliations%rowtype; packet public.ops_source_packets%rowtype;
begin
 select * into reconciliation from public.ops_reconciliations where id=p_id;
 select * into packet from public.ops_source_packets where id=reconciliation.packet_id;
 if reconciliation.id is null or not public.has_ops_capability('finance.review',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=packet.ad_account_id for update;
 select * into reconciliation from public.ops_reconciliations where id=p_id for update;
 if reconciliation.status<>'pending' or exists(select 1 from public.ops_source_packets where ad_account_id=packet.ad_account_id and period=packet.period and version>packet.version) then raise exception 'Stale review' using errcode='40001'; end if;
 if reconciliation.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review decision and note required' using errcode='22023'; end if;
 if p_decision='approved' and reconciliation.settlement_date<>(now() at time zone 'Asia/Shanghai')::date then raise exception 'Quote expired; prepare a fresh revision' using errcode='22023'; end if;
 update public.ops_reconciliations set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) where id=p_id;
 update public.ops_source_packets set status=case when p_decision='approved' then 'ready_for_publication' else 'submitted' end where id=packet.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_reconciliation',p_id,'UPDATE',jsonb_build_object('status',p_decision));
 -- No wallet debit, client report publication, bank payment or advertising API call occurs here.
end;
$$;
create function public.protect_ops_packet() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or (to_jsonb(OLD)-array['status','source_feedback']) is distinct from (to_jsonb(NEW)-array['status','source_feedback']) then raise exception 'Source versions are immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
create function public.protect_ops_reconciliation() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or OLD.status<>'pending' or NEW.status not in ('approved','rejected','superseded') or (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_note']) is distinct from (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_note']) then raise exception 'Reconciliation revisions are immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
revoke all on function public.protect_ops_packet(),public.protect_ops_reconciliation() from public,anon,authenticated;
create trigger immutable_ops_source before update or delete on public.ops_source_packets for each row execute function public.protect_ops_packet();
create trigger immutable_ops_reconciliation before update or delete on public.ops_reconciliations for each row execute function public.protect_ops_reconciliation();

create table public.service_requests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 category text not null check(category in ('account','report','billing','other')),
 subject text not null check(char_length(btrim(subject)) between 3 and 160),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.service_request_messages (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.service_requests(id),
 body text not null check(char_length(btrim(body)) between 3 and 1500),
 author_id uuid not null references auth.users(id),author_role text not null check(author_role in ('client','staff')),
 created_at timestamptz not null default now()
);
alter table public.service_requests enable row level security;
alter table public.service_request_messages enable row level security;
revoke all on public.service_requests,public.service_request_messages from public,anon,authenticated;
grant select(id,organization_id,category,subject,status,created_at,updated_at) on public.service_requests to authenticated;
grant select(id,request_id,body,author_role,created_at) on public.service_request_messages to authenticated;
grant select,insert,update on public.service_requests,public.service_request_messages to service_role;
create index service_request_org_date on public.service_requests(organization_id,updated_at desc);
create index service_messages_request on public.service_request_messages(request_id,created_at);
create function public.can_read_service_request(p_org uuid,p_category text) returns boolean language sql stable security definer set search_path='' as $$
 select (case when p_category='billing' then public.has_ops_capability('finance.read',p_org) else public.has_ops_capability('support.handle',p_org) end)
 or (not exists(select 1 from public.staff_members where user_id=auth.uid()) and exists(select 1 from public.memberships where organization_id=p_org and user_id=auth.uid()) and (p_category<>'billing' or public.has_finance_access(p_org)));
$$;
revoke all on function public.can_read_service_request(uuid,text) from public,anon;
grant execute on function public.can_read_service_request(uuid,text) to authenticated;
create policy scoped_service_requests on public.service_requests for select to authenticated using(public.can_read_service_request(organization_id,category));
create policy scoped_service_messages on public.service_request_messages for select to authenticated using(exists(select 1 from public.service_requests r where r.id=request_id));
create function public.create_service_request(p_org uuid,p_category text,p_subject text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) or not public.can_read_service_request(p_org,p_category) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if (select count(*) from public.service_requests where organization_id=p_org and status<>'resolved')>=20 then raise exception 'Open request limit' using errcode='54000'; end if;
 insert into public.service_requests(organization_id,category,subject,created_by) values(p_org,p_category,btrim(p_subject),auth.uid()) returning id into result;
 insert into public.service_request_messages(request_id,body,author_id,author_role) values(result,btrim(p_body),auth.uid(),'client');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',result,'INSERT',jsonb_build_object('organization_id',p_org,'category',p_category));
 return result;
end;
$$;
create function public.reply_service_request(p_id uuid,p_body text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare request public.service_requests%rowtype; staff boolean;
begin
 select * into request from public.service_requests where id=p_id for update;
 if not found or not public.can_read_service_request(request.organization_id,request.category) then raise exception 'Forbidden' using errcode='42501'; end if;
 if (select count(*) from public.service_request_messages where request_id=p_id)>=200 then raise exception 'Message limit' using errcode='54000'; end if;
 staff:=exists(select 1 from public.staff_members where user_id=auth.uid());
 insert into public.service_request_messages(request_id,body,author_id,author_role) values(p_id,btrim(p_body),auth.uid(),case when staff then 'staff' else 'client' end);
 update public.service_requests set status=case when staff then p_status when status='resolved' then 'open' else status end,updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',p_id,'UPDATE',jsonb_build_object('status',case when staff then p_status else 'client_reply' end));
end;
$$;
create function public.get_ops_wallet_summary(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'currency',w.currency,'balance_minor',coalesce((select sum(e.amount_minor) from public.wallet_entries e where e.wallet_id=w.id),0)::text,'pending_topups',(select count(*) from public.client_topups t where t.wallet_id=w.id and t.status='pending'))) from public.client_wallets w where w.organization_id=p_org),'[]'::jsonb);
end;
$$;
revoke all on function public.get_ops_wallet_summary(uuid) from public,anon;
grant execute on function public.get_ops_wallet_summary(uuid) to authenticated;
revoke all on function public.get_ops_context(),public.assign_operating_role(uuid,text,text,boolean),public.list_operating_staff(),public.ops_link_account(uuid,text,text),public.submit_ops_source(uuid,uuid,date,text,bigint,text,text,text,text),public.return_ops_source(uuid,text),public.prepare_ops_reconciliation(uuid,uuid,integer,text),public.review_ops_reconciliation(uuid,text,text),public.create_service_request(uuid,text,text,text),public.reply_service_request(uuid,text,text) from public,anon;
grant execute on function public.get_ops_context(),public.assign_operating_role(uuid,text,text,boolean),public.list_operating_staff(),public.ops_link_account(uuid,text,text),public.submit_ops_source(uuid,uuid,date,text,bigint,text,text,text,text),public.return_ops_source(uuid,text),public.prepare_ops_reconciliation(uuid,uuid,integer,text),public.review_ops_reconciliation(uuid,text,text),public.create_service_request(uuid,text,text,text),public.reply_service_request(uuid,text,text) to authenticated;
-- END 011_three_party_operations.sql

-- START 012_manual_bank_collections.sql
-- Phase 1: verified bank receipts, independent approval and atomic CNY ledger posting.
-- No bank API, online payment, cash transfer or synthetic receipt is executed.

create table public.collection_accounts (
 id uuid primary key default gen_random_uuid(), legal_name text not null check(char_length(btrim(legal_name)) between 2 and 180),
 bank_name text not null check(char_length(btrim(bank_name)) between 2 and 180),
 account_number text not null check(account_number ~ '^[0-9A-Za-z -]{6,50}$'),
 currency text not null default 'CNY' check(currency='CNY'),
 verification_reference text not null check(char_length(btrim(verification_reference)) between 3 and 180),
 active boolean not null default true, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(bank_name,account_number)
);
create table public.wallet_collection_accounts (
 wallet_id uuid primary key references public.client_wallets(id), collection_account_id uuid not null references public.collection_accounts(id),
 agreement_reference text not null check(char_length(btrim(agreement_reference)) between 3 and 180), assigned_by uuid not null references auth.users(id), assigned_at timestamptz not null default now()
);
create table public.bank_receipts (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null default 'CNY' check(currency='CNY'),
 collection_account_id uuid not null references public.collection_accounts(id), topup_id uuid references public.client_topups(id),
 amount_minor bigint not null check(amount_minor between 1 and 9999999999), payer_name text not null check(char_length(btrim(payer_name)) between 2 and 180),
 bank_reference text not null check(char_length(btrim(bank_reference)) between 3 and 120),
 bank_reference_normalized text generated always as (upper(regexp_replace(bank_reference,'[[:space:]]','','g'))) stored, booked_date date not null,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 180),
 status text not null default 'pending' check(status in ('pending','credited','rejected')),
 prepared_by uuid not null references auth.users(id), prepared_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text,
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 check(reviewed_by is null or reviewed_by<>prepared_by)
);
create unique index one_active_bank_transaction on public.bank_receipts(collection_account_id,bank_reference_normalized) where status<>'rejected';
create unique index one_receipt_per_topup on public.bank_receipts(topup_id) where topup_id is not null and status<>'rejected';
alter table public.collection_accounts enable row level security;
alter table public.wallet_collection_accounts enable row level security;
alter table public.bank_receipts enable row level security;
revoke all on public.collection_accounts,public.wallet_collection_accounts,public.bank_receipts from public,anon,authenticated;
grant select on public.collection_accounts,public.wallet_collection_accounts to authenticated;
grant select(id,wallet_id,organization_id,currency,collection_account_id,topup_id,amount_minor,payer_name,bank_reference,booked_date,evidence_reference,status,prepared_by,prepared_at,reviewed_at,review_note) on public.bank_receipts to authenticated;
grant select,insert,update on public.collection_accounts,public.wallet_collection_accounts,public.bank_receipts to service_role;
create policy finance_collection_accounts on public.collection_accounts for select to authenticated using(public.has_ops_capability('finance.read'));
create policy finance_collection_links on public.wallet_collection_accounts for select to authenticated using(exists(select 1 from public.client_wallets w where w.id=wallet_id and public.has_ops_capability('finance.read',w.organization_id)));
create policy finance_bank_receipts on public.bank_receipts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create function public.create_collection_account(p_legal text,p_bank text,p_number text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.collection_accounts(legal_name,bank_name,account_number,verification_reference,created_by) values(btrim(p_legal),btrim(p_bank),btrim(p_number),btrim(p_evidence),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'collection_account',result,'INSERT','{"verified_manually":true}'::jsonb);
 return result;
end;
$$;
create function public.assign_collection_account(p_wallet uuid,p_account uuid,p_agreement text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.client_wallets where id=p_wallet and currency='CNY') or not exists(select 1 from public.collection_accounts where id=p_account and active) then raise exception 'Active CNY collection account required' using errcode='22023'; end if;
 insert into public.wallet_collection_accounts(wallet_id,collection_account_id,agreement_reference,assigned_by) values(p_wallet,p_account,btrim(p_agreement),auth.uid()) on conflict(wallet_id) do update set collection_account_id=excluded.collection_account_id,agreement_reference=excluded.agreement_reference,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'wallet_collection',p_wallet,'UPDATE',jsonb_build_object('account_id',p_account));
end;
$$;
create function public.set_collection_account_active(p_account uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_active is null then raise exception 'Status required' using errcode='22023'; end if;
 update public.collection_accounts set active=p_active where id=p_account;
 if not found then raise exception 'Account unavailable' using errcode='22023'; end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'collection_account',p_account,'UPDATE',jsonb_build_object('active',p_active));
end;
$$;
create function public.get_collection_instructions(p_wallet uuid) returns table(legal_name text,bank_name text,account_number text,currency text,agreement_reference text) language sql stable security definer set search_path='' as $$
 select a.legal_name,a.bank_name,a.account_number,a.currency,l.agreement_reference from public.wallet_collection_accounts l join public.collection_accounts a on a.id=l.collection_account_id join public.client_wallets w on w.id=l.wallet_id where w.id=p_wallet and a.active and public.has_finance_access(w.organization_id);
$$;
create function public.prepare_bank_receipt(p_wallet uuid,p_topup uuid,p_amount bigint,p_payer text,p_bank_reference text,p_booked date,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.client_wallets%rowtype; account uuid; result uuid;
begin
 select * into w from public.client_wallets where id=p_wallet for update;
 if not found or not public.has_ops_capability('finance.prepare',w.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select a.id into account from public.wallet_collection_accounts l join public.collection_accounts a on a.id=l.collection_account_id where l.wallet_id=p_wallet and a.active for share of l,a;
 if account is null or w.currency<>'CNY' then raise exception 'Verified collection instructions required' using errcode='22023'; end if;
 if p_booked is null or p_booked>(now() at time zone 'Asia/Shanghai')::date then raise exception 'Actual booked date required' using errcode='22023'; end if;
 if p_topup is not null and not exists(select 1 from public.client_topups where id=p_topup and wallet_id=p_wallet and amount_minor=p_amount and status='pending' and currency='CNY') then raise exception 'Topup does not match receipt' using errcode='22023'; end if;
 insert into public.bank_receipts(wallet_id,organization_id,collection_account_id,topup_id,amount_minor,payer_name,bank_reference,booked_date,evidence_reference,prepared_by) values(w.id,w.organization_id,account,p_topup,p_amount,btrim(p_payer),btrim(p_bank_reference),p_booked,btrim(p_evidence),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'bank_receipt',result,'INSERT',jsonb_build_object('wallet_id',w.id));
 return result;
end;
$$;
create function public.review_bank_receipt(p_receipt uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.bank_receipts%rowtype;
begin
 select * into r from public.bank_receipts where id=p_receipt;
 if not found or not public.has_ops_capability('finance.review',r.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 -- Lock wallet before receipt, matching preparation's lock order.
 perform 1 from public.client_wallets where id=r.wallet_id for update;
 select * into r from public.bank_receipts where id=p_receipt for update;
 if r.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('credited','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review decision and note required' using errcode='22023'; end if;
 -- Same decision retries succeed without a second posting; conflicting retries fail.
 if r.status<>'pending' then
  if r.status=p_decision then return; end if;
  raise exception 'Receipt already reviewed' using errcode='40001';
 end if;
 if p_decision='credited' then
  perform 1 from public.collection_accounts where id=r.collection_account_id and active for share;
  if not found then raise exception 'Collection account paused' using errcode='22023'; end if;
  if r.topup_id is not null then
   perform 1 from public.client_topups where id=r.topup_id and wallet_id=r.wallet_id and amount_minor=r.amount_minor and status='pending' for update;
   if not found then raise exception 'Topup no longer pending' using errcode='40001'; end if;
  end if;
  insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(r.wallet_id,r.organization_id,'CNY','topup',r.amount_minor,'对公转账到账 / Verified bank receipt','bank-receipt:'||r.id::text);
  if r.topup_id is not null then update public.client_topups set status='credited' where id=r.topup_id; end if;
 end if;
 update public.bank_receipts set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) where id=r.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'bank_receipt',r.id,'UPDATE',jsonb_build_object('status',p_decision));
end;
$$;
create function public.protect_bank_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or OLD.status<>'pending' or NEW.status not in ('credited','rejected') or (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_note','bank_reference_normalized']) is distinct from (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_note','bank_reference_normalized']) then raise exception 'Receipt evidence is immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
create trigger immutable_bank_receipt before update or delete on public.bank_receipts for each row execute function public.protect_bank_receipt();
create function public.protect_collection_account() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or (to_jsonb(OLD)-'active') is distinct from (to_jsonb(NEW)-'active') then raise exception 'Collection account identity is immutable; create a new account' using errcode='42501'; end if;
 return NEW;
end;
$$;
create trigger immutable_collection_identity before update or delete on public.collection_accounts for each row execute function public.protect_collection_account();
revoke all on function public.protect_bank_receipt(),public.protect_collection_account() from public,anon,authenticated;
revoke all on function public.create_collection_account(text,text,text,text),public.assign_collection_account(uuid,uuid,text),public.set_collection_account_active(uuid,boolean),public.get_collection_instructions(uuid),public.prepare_bank_receipt(uuid,uuid,bigint,text,text,date,text),public.review_bank_receipt(uuid,text,text) from public,anon;
grant execute on function public.create_collection_account(text,text,text,text),public.assign_collection_account(uuid,uuid,text),public.set_collection_account_active(uuid,boolean),public.get_collection_instructions(uuid),public.prepare_bank_receipt(uuid,uuid,bigint,text,text,date,text),public.review_bank_receipt(uuid,text,text) to authenticated;
-- END 012_manual_bank_collections.sql

-- START 013_customer_applications.sql
-- Authenticated customer applications. Approval creates a prospect CRM record only.
-- Company membership, finance access, contracts, wallets and ad accounts require separate authorization.

create table public.customer_applications (
 id uuid primary key default gen_random_uuid(), applicant_id uuid not null references auth.users(id),
 legal_name text not null check(char_length(btrim(legal_name)) between 2 and 160),
 contact_name text not null check(char_length(btrim(contact_name)) between 2 and 100),
 phone_e164 text not null check(phone_e164 ~ '^\+861[3-9][0-9]{9}$'),
 email text check(email is null or (char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 website text check(website is null or (char_length(website)<=500 and website ~ '^https://[^[:space:]@]+$')),
 industry text not null check(char_length(btrim(industry)) between 2 and 100),
 target_market text not null check(target_market in ('undecided','north-america','europe','asia-pacific','global','other')),
 goals text not null check(char_length(btrim(goals)) between 10 and 2000),
 locale text not null check(locale in ('zh','en')), consent_at timestamptz not null default now(), consent_version text not null default 'application-v1',
 status text not null default 'submitted' check(status in ('submitted','needs_information','approved','rejected','withdrawn')),
 revision integer not null default 1 check(revision>0),
 feedback text, organization_id uuid references public.organizations(id),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_application on public.customer_applications(applicant_id) where status in ('submitted','needs_information');
create index applications_staff_queue on public.customer_applications(status,updated_at desc);
create table public.customer_application_history (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.customer_applications(id),
 revision integer not null, event text not null check(event in ('submitted','resubmitted','needs_information','approved','rejected','withdrawn')),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 snapshot jsonb not null
);
alter table public.customer_applications enable row level security;
alter table public.customer_application_history enable row level security;
revoke all on public.customer_applications,public.customer_application_history from public,anon,authenticated;
grant select(id,legal_name,contact_name,phone_e164,email,website,industry,target_market,goals,locale,status,revision,feedback,organization_id,created_at,updated_at,reviewed_at) on public.customer_applications to authenticated;
grant select on public.customer_application_history to service_role;
grant select,insert,update on public.customer_applications to service_role;
grant insert on public.customer_application_history to service_role;
create policy own_applications on public.customer_applications for select to authenticated using(applicant_id=auth.uid());
create policy china_application_queue on public.customer_applications for select to authenticated using(public.has_staff_access());
create trigger immutable_application_history before update or delete on public.customer_application_history for each row execute function public.lock_posted_money();
create function public.save_customer_application(p_id uuid,p_revision integer,p_legal text,p_contact text,p_email text,p_website text,p_industry text,p_market text,p_goals text,p_locale text) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); verified_phone text; current_row public.customer_applications%rowtype; result uuid;
begin
 if who is null or exists(select 1 from public.staff_members where user_id=who) then raise exception 'Customer session required' using errcode='42501'; end if;
 -- Auth's verified phone is authoritative; caller metadata and submitted phone fields are ignored.
 select '+'||ltrim(phone,'+') into verified_phone from auth.users where id=who and phone_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now()) for update;
 if verified_phone is null or verified_phone !~ '^\+861[3-9][0-9]{9}$' then raise exception 'Verified mainland phone required' using errcode='42501'; end if;
 if (select count(*) from auth.users where phone in (verified_phone,ltrim(verified_phone,'+')) and phone_confirmed_at is not null and deleted_at is null)<>1 then raise exception 'Unique verified identity required' using errcode='42501'; end if;
 if p_id is null then
  if p_revision is distinct from 0 then raise exception 'Invalid initial revision' using errcode='22023'; end if;
  if (select count(*) from public.customer_applications where applicant_id=who and created_at>now()-interval '24 hours')>=3 then raise exception 'Daily application limit' using errcode='54000'; end if;
  insert into public.customer_applications(applicant_id,legal_name,contact_name,phone_e164,email,website,industry,target_market,goals,locale) values(who,btrim(p_legal),btrim(p_contact),verified_phone,nullif(btrim(p_email),''),nullif(btrim(p_website),''),btrim(p_industry),p_market,btrim(p_goals),p_locale) returning id into result;
 else
  select * into current_row from public.customer_applications where id=p_id for update;
  if not found or current_row.applicant_id<>who then raise exception 'Forbidden' using errcode='42501'; end if;
  if current_row.status<>'needs_information' or p_revision is distinct from current_row.revision then raise exception 'Application changed or closed' using errcode='40001'; end if;
  if current_row.revision>=40 then raise exception 'Application revision limit; contact support' using errcode='54000'; end if;
  update public.customer_applications set legal_name=btrim(p_legal),contact_name=btrim(p_contact),phone_e164=verified_phone,email=nullif(btrim(p_email),''),website=nullif(btrim(p_website),''),industry=btrim(p_industry),target_market=p_market,goals=btrim(p_goals),locale=p_locale,status='submitted',revision=revision+1,feedback=null,reviewed_by=null,reviewed_at=null,consent_at=now(),updated_at=now() where id=p_id;
  result:=p_id;
 end if;
 insert into public.customer_application_history(application_id,revision,event,actor_id,snapshot) select id,revision,case when p_id is null then 'submitted' else 'resubmitted' end,who,to_jsonb(a)-array['applicant_id','reviewed_by'] from public.customer_applications a where id=result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(who,'customer_application',result,case when p_id is null then 'INSERT' else 'UPDATE' end,jsonb_build_object('event',case when p_id is null then 'submitted' else 'resubmitted' end));
 return result;
end;
$$;
create function public.withdraw_customer_application(p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare a public.customer_applications%rowtype;
begin
 select * into a from public.customer_applications where id=p_id for update;
 if not found or a.applicant_id is distinct from auth.uid() or exists(select 1 from public.staff_members where user_id=auth.uid()) then raise exception 'Forbidden' using errcode='42501'; end if;
 if a.status not in ('submitted','needs_information') or p_revision is distinct from a.revision then raise exception 'Application changed or closed' using errcode='40001'; end if;
 update public.customer_applications set status='withdrawn',revision=revision+1,updated_at=now() where id=p_id;
 insert into public.customer_application_history(application_id,revision,event,actor_id,snapshot) values(p_id,a.revision+1,'withdrawn',auth.uid(),jsonb_build_object('previous_status',a.status));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'customer_application',p_id,'UPDATE','{"status":"withdrawn"}');
end;
$$;
create function public.review_customer_application(p_id uuid,p_revision integer,p_decision text,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.customer_applications%rowtype; org uuid;
begin
 if not public.has_staff_access() then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into a from public.customer_applications where id=p_id for update;
 if not found then raise exception 'Application unavailable' using errcode='P0002'; end if;
 if a.applicant_id=auth.uid() then raise exception 'Independent application reviewer required' using errcode='42501'; end if;
 if a.status<>'submitted' or p_revision is distinct from a.revision then raise exception 'Application changed or closed' using errcode='40001'; end if;
 if p_decision is null or p_decision not in ('needs_information','approved','rejected') or p_feedback is null or char_length(btrim(p_feedback)) not between 3 and 1000 then raise exception 'Customer-visible feedback required' using errcode='22023'; end if;
 if p_decision='approved' then
  -- An application is not proof of authority over an existing company: never auto-link by name/email/phone.
  org:=public.save_crm_client(null,a.legal_name,a.legal_name,'','CN',coalesce(a.website,''),a.industry,'prospect','Created from reviewed customer application',0);
  perform public.save_crm_contact(org,null,a.contact_name,'',a.phone_e164,coalesce(a.email,''),'business');
 end if;
 update public.customer_applications set status=p_decision,feedback=btrim(p_feedback),organization_id=org,reviewed_by=auth.uid(),reviewed_at=now(),revision=revision+1,updated_at=now() where id=p_id;
 insert into public.customer_application_history(application_id,revision,event,actor_id,snapshot) values(p_id,a.revision+1,p_decision,auth.uid(),jsonb_build_object('feedback',btrim(p_feedback),'organization_id',org));
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'customer_application',p_id,'UPDATE',jsonb_build_object('status',p_decision,'organization_id',org));
 return org;
end;
$$;
create function public.get_my_customer_applications() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(a)-array['applicant_id','reviewed_by']),'[]'::jsonb) from (select * from public.customer_applications where applicant_id=auth.uid() order by created_at desc limit 20) a;
$$;
revoke all on function public.get_my_customer_applications() from public,anon;
grant execute on function public.get_my_customer_applications() to authenticated;
revoke all on function public.save_customer_application(uuid,integer,text,text,text,text,text,text,text,text),public.withdraw_customer_application(uuid,integer),public.review_customer_application(uuid,integer,text,text) from public,anon;
grant execute on function public.save_customer_application(uuid,integer,text,text,text,text,text,text,text,text),public.withdraw_customer_application(uuid,integer),public.review_customer_application(uuid,integer,text,text) to authenticated;
-- END 013_customer_applications.sql

-- Refresh the Data API schema only after the full transaction succeeds.
notify pgrst, 'reload schema';
commit;
