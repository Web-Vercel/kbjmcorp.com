-- Company records use the same authenticated scope as the client project workspace.
begin;
create or replace function public.get_my_company_profiles() returns table(id uuid,name text,legal_name text,registration_number text,country text,website text,status text)
language sql stable security definer set search_path='' as $$
 select o.id,o.name,p.legal_name,p.registration_number,p.country,p.website,p.status
 from jsonb_to_recordset(public.get_client_project_scope()) as scope(id uuid,name text,collaborate boolean)
 join public.organizations o on o.id=scope.id
 left join public.client_profiles p on p.organization_id=o.id;
$$;
-- Existing has_finance_access validates active dedicated clients and legacy finance grants.
-- The client_visible_contracts policy remains responsible for visibility and draft exclusion.
notify pgrst,'reload schema';
commit;
