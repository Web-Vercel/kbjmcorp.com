begin;

create table public.monthly_pricing_rates (
  revision bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id),
  effective_month date not null check (extract(day from effective_month) = 1 and effective_month between date '2000-01-01' and date '9999-12-01'),
  canada_bps integer check (canada_bps between 0 and 10000),
  china_bps integer check (china_bps between 0 and 10000),
  transfer_bps integer check (transfer_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  check (organization_id is not null or (canada_bps is not null and china_bps is not null and transfer_bps is not null))
);

create index monthly_pricing_rates_lookup on public.monthly_pricing_rates
  (organization_id, effective_month desc, revision desc);

alter table public.monthly_pricing_rates enable row level security;
revoke all on public.monthly_pricing_rates from public, anon, authenticated;
grant select on public.monthly_pricing_rates to authenticated;
grant insert (organization_id, effective_month, canada_bps, china_bps, transfer_bps)
  on public.monthly_pricing_rates to authenticated;

create policy monthly_pricing_rates_read on public.monthly_pricing_rates for select to authenticated
  using ((select public.has_staff_access(array['admin']::text[])));
create policy monthly_pricing_rates_insert on public.monthly_pricing_rates for insert to authenticated
  with check ((select public.has_staff_access(array['admin']::text[])));

commit;
