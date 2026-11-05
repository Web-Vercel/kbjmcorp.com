-- Design draft. Apply only to a NEW, explicitly approved Supabase project.
begin;
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
commit;
