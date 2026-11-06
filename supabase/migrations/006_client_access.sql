-- Verified, pre-existing Auth users only. Never look up users by a public phone number.
begin;
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
commit;
