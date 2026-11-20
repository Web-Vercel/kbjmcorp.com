-- Connect dedicated client identities to existing versioned project collaboration.
begin;
create function public.get_client_project_scope() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype; result jsonb;
begin
 if exists(select 1 from public.live_access_accounts where user_id=auth.uid()) then
  a:=public.require_live_account(true);
  if a.role<>'client' then raise exception 'Client access required' using errcode='42501';end if;
  select jsonb_build_array(jsonb_build_object('id',o.id,'name',o.name,'collaborate',true)) into result from public.organizations o where o.id=a.organization_id;
  return coalesce(result,'[]'::jsonb);
 end if;
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) then raise exception 'Client access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'collaborate',m.role in ('owner','admin'))),'[]'::jsonb) into result from public.memberships m join public.organizations o on o.id=m.organization_id where m.user_id=auth.uid();
 return result;
end $$;
revoke all on function public.get_client_project_scope() from public,anon;
grant execute on function public.get_client_project_scope() to authenticated;
create policy live_client_projects on public.projects for select to authenticated using(public.has_live_client_access(organization_id));
create or replace function public.can_collaborate(p_organization_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.staff_members where user_id=auth.uid()) and
 case when exists(select 1 from public.live_access_accounts where user_id=auth.uid()) then public.has_live_client_access(p_organization_id)
 else exists(select 1 from public.memberships where user_id=auth.uid() and organization_id=p_organization_id and role in ('owner','admin')) end;
$$;
notify pgrst,'reload schema';
commit;
