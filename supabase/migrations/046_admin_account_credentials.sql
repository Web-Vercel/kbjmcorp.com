-- Administrator credential maintenance. No accounts, passwords, grants or financial records seeded.
begin;
create table public.account_credential_state(
 user_id uuid primary key references auth.users(id),session_after timestamptz not null default clock_timestamp(),
 locked boolean not null default false,operation_id uuid,revision integer not null default 0
);
create table public.account_credential_operations(
 id uuid primary key,actor_id uuid not null references auth.users(id),target_id uuid not null references auth.users(id),
 action text not null check(action in ('password','email')),old_email text not null,new_email text,
 status text not null default 'pending' check(status in ('pending','succeeded','failed','uncertain','reconciled')),
 reason text not null check(char_length(btrim(reason)) between 3 and 1000),started_at timestamptz not null default clock_timestamp(),finished_by uuid references auth.users(id),finished_at timestamptz
);
alter table public.account_credential_state enable row level security;
alter table public.account_credential_operations enable row level security;
revoke all on public.account_credential_state,public.account_credential_operations from public,anon,authenticated;
grant select on public.account_credential_operations to authenticated;
-- Accounts without maintenance history retain their existing session rules.
create function public.account_credential_session_valid() returns boolean language plpgsql stable security definer set search_path='' as $$
declare s public.account_credential_state%rowtype;sid uuid;started timestamptz;
begin
 select * into s from public.account_credential_state where user_id=auth.uid();if not found then return true;end if;
 if s.locked then return false;end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then return false;end;
 select created_at into started from auth.sessions where id=sid and user_id=auth.uid();
 return coalesce(started>=s.session_after,false);
end $$;
revoke all on function public.account_credential_session_valid() from public,anon;
grant execute on function public.account_credential_session_valid() to authenticated;

create or replace function public.has_staff_access(p_roles text[] default array['admin','operator']::text[]) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_credential_session_valid() and coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and s.role=any(p_roles)
 and (s.role='admin' or exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code where r.user_id=s.user_id and r.active and u.active and r.unit_code='zhidian_cn' and r.role='customer_service')));
$$;

create or replace function public.has_ops_capability(p_cap text,p_org uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select public.account_credential_session_valid() and coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and
 (s.role='admin' or (s.role='operator' and exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code
 where r.user_id=s.user_id and r.active and u.active and
 ((p_cap in ('source.read','source.submit','account.link') and r.role='ad_operations')
 or (p_cap='finance.read' and r.role in ('finance_preparer','finance_reviewer'))
 or (p_cap='finance.prepare' and r.role='finance_preparer') or (p_cap='finance.review' and r.role='finance_reviewer')
 or (p_cap='support.handle' and r.role='customer_service') or (p_cap='client.read'))
 and (p_org is null or exists(select 1 from public.client_operating_links l where l.organization_id=p_org and
 ((u.kind='fulfilment' and l.fulfilment_unit=u.code) or (u.kind='market' and l.market_unit=u.code))))))));
$$;

create or replace function public.require_live_account(p_mfa boolean default true) returns public.live_access_accounts language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;u jsonb;sid uuid;started timestamptz;
begin
 select * into a from public.live_access_accounts where user_id=auth.uid();
 if not found or not a.active or not public.account_credential_session_valid() or (p_mfa and a.role<>'client' and coalesce(auth.jwt()->>'aal','')<>'aal2') then raise exception 'Account unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(v) into u from auth.users v where v.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Account unavailable' using errcode='42501';end if;
 if exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting account grants' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then raise exception 'Fresh sign-in required' using errcode='42501';end;
 select s.created_at into started from auth.sessions s where s.id=sid and s.user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;
 return a;
end $$;

create or replace function public.require_partner_agent(p_mfa boolean default true) returns public.partner_agents language plpgsql security definer set search_path='' as $$
declare a public.partner_agents%rowtype;u jsonb;started timestamptz;begin
 select * into a from public.partner_agents where user_id=auth.uid();
 if not found or not a.active or not public.account_credential_session_valid() then raise exception 'Agent unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(x) into u from auth.users x where x.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Agent unavailable' using errcode='42501';end if;
 if exists(select 1 from public.live_access_accounts where user_id=a.user_id) or exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting agent identity' using errcode='42501';end if;
 select created_at into started from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;return a;
end $$;

create policy admin_credential_operation_read on public.account_credential_operations for select to authenticated using(public.has_staff_access(array['admin']::text[]));
-- The staff identity lookup must also reject old/maintenance-locked sessions.
drop policy own_staff_identity on public.staff_members;
create policy own_staff_identity on public.staff_members for select to authenticated using(user_id=auth.uid() and public.account_credential_session_valid());
create function public.list_managed_accounts() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501';end if;
 select coalesce(jsonb_agg(row_data order by row_data->>'email'),'[]'::jsonb) into result from (
  select jsonb_build_object('userId',u.id,'email',u.email,'label',coalesce(l.label,a.label,u.email),'role',coalesce(s.role,l.role,case when a.id is not null then 'agent' end),'company',o.name,'active',coalesce(s.active,l.active,a.active),'self',u.id=auth.uid(),
   'duties',(select coalesce(jsonb_agg(r.role),'[]'::jsonb) from public.staff_unit_roles r where r.user_id=u.id and r.active),
   'locked',coalesce(st.locked,false),'operationId',case when st.locked then st.operation_id end) row_data
  from auth.users u left join public.staff_members s on s.user_id=u.id left join public.live_access_accounts l on l.user_id=u.id left join public.partner_agents a on a.user_id=u.id left join public.organizations o on o.id=l.organization_id left join public.account_credential_state st on st.user_id=u.id
  where (s.user_id is not null or l.user_id is not null or a.user_id is not null) and nullif(to_jsonb(u)->>'deleted_at','') is null
 ) rows;
 return result;
end $$;
revoke all on function public.list_managed_accounts() from public,anon;
grant execute on function public.list_managed_accounts() to authenticated;
create function public.begin_account_credential_change(p_id uuid,p_target uuid,p_action text,p_expected_email text,p_new_email text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare u jsonb;op public.account_credential_operations%rowtype;
begin
 if not public.has_staff_access(array['admin']::text[]) or p_target=auth.uid() then raise exception 'Forbidden' using errcode='42501';end if;
 if p_id is null or p_target is null or p_action is null or p_action not in ('password','email') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 1000 or (p_action='email' and (p_new_email is null or char_length(p_new_email) not between 3 and 254 or p_new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) or (p_action='password' and p_new_email is not null) then raise exception 'Invalid input' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('credential-maintenance:'||p_target::text,0));perform pg_advisory_xact_lock(hashtextextended('live-access:'||p_target::text,0));
 if exists(select 1 from public.account_credential_operations where id=p_id) or exists(select 1 from public.account_credential_state where user_id=p_target and locked) then raise exception 'Maintenance conflict' using errcode='40001';end if;
 if not (exists(select 1 from public.staff_members where user_id=p_target) or exists(select 1 from public.live_access_accounts where user_id=p_target) or exists(select 1 from public.partner_agents where user_id=p_target)) then raise exception 'Unknown managed account' using errcode='42501';end if;
 select to_jsonb(a) into u from auth.users a where a.id=p_target;
 if u is null or nullif(u->>'deleted_at','') is not null or lower(u->>'email') is distinct from lower(btrim(p_expected_email)) then raise exception 'Stale account email' using errcode='40001';end if;
 if p_action='email' and (lower(btrim(p_new_email))=lower(u->>'email') or exists(select 1 from auth.users where lower(email)=lower(btrim(p_new_email)) and id<>p_target)) then raise exception 'Email unavailable' using errcode='22023';end if;
 insert into public.account_credential_operations(id,actor_id,target_id,action,old_email,new_email,reason) values(p_id,auth.uid(),p_target,p_action,lower(u->>'email'),case when p_action='email' then lower(btrim(p_new_email)) end,btrim(p_reason));
 insert into public.account_credential_state(user_id,locked,operation_id,revision) values(p_target,true,p_id,1) on conflict(user_id) do update set locked=true,operation_id=p_id,session_after=clock_timestamp(),revision=account_credential_state.revision+1;
 update public.live_access_accounts set session_after=clock_timestamp(),revision=revision+1 where user_id=p_target;
 update public.partner_agents set session_after=clock_timestamp(),revision=revision+1 where user_id=p_target;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'account_credentials',p_target,'UPDATE',jsonb_build_object('operation_id',p_id,'action',p_action,'status','pending'));
 return p_id;
end $$;
revoke all on function public.begin_account_credential_change(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.begin_account_credential_change(uuid,uuid,text,text,text,text) to authenticated;
-- Only the server secret can finish after an Auth Admin SDK response. Never accepts passwords.
create function public.finish_account_credential_change(p_id uuid,p_result text,p_actor uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare op public.account_credential_operations%rowtype;u jsonb;email text;maintenance_locked boolean;result text:=p_result;
begin
 if p_result is null or p_result not in ('succeeded','failed','uncertain','reconciled') then raise exception 'Invalid result' using errcode='22023';end if;
 select * into op from public.account_credential_operations where id=p_id for update;if not found then raise exception 'Unknown maintenance' using errcode='22023';end if;
 if not exists(select 1 from public.staff_members where user_id=coalesce(p_actor,op.actor_id) and role='admin' and active) then raise exception 'Administrator unavailable' using errcode='42501';end if;
 if op.status not in ('pending','uncertain') then return jsonb_build_object('status',op.status);end if;
 perform pg_advisory_xact_lock(hashtextextended('credential-maintenance:'||op.target_id::text,0));perform pg_advisory_xact_lock(hashtextextended('live-access:'||op.target_id::text,0));
 if p_result='reconciled' and op.started_at>clock_timestamp()-interval '60 seconds' then raise exception 'Maintenance still running' using errcode='40001';end if;
 select to_jsonb(a) into u from auth.users a where a.id=op.target_id;email:=lower(u->>'email');
 if u is null or nullif(u->>'deleted_at','') is not null then result:='uncertain';
 elsif op.action='email' then
  if p_result='succeeded' and (email is distinct from op.new_email or nullif(u->>'email_confirmed_at','') is null) then result:='uncertain';end if;
  if p_result='failed' and email is distinct from op.old_email then result:='uncertain';end if;
  if p_result='reconciled' and (email not in (op.old_email,op.new_email) or nullif(u->>'email_confirmed_at','') is null) then result:='uncertain';end if;
  if result in ('succeeded','reconciled') then
   update public.live_access_accounts set expected_email=email,revision=revision+1,session_after=clock_timestamp(),changed_by=coalesce(p_actor,op.actor_id),changed_at=now() where user_id=op.target_id;
   update public.partner_agents set expected_email=email,revision=revision+1,session_after=clock_timestamp() where user_id=op.target_id;
  end if;
 end if;
 maintenance_locked:=result='uncertain';
 update public.account_credential_operations set status=result,finished_by=coalesce(p_actor,op.actor_id),finished_at=case when maintenance_locked then null else clock_timestamp() end where id=p_id;
 update public.account_credential_state set locked=maintenance_locked,session_after=clock_timestamp(),revision=revision+1 where user_id=op.target_id and operation_id=p_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(coalesce(p_actor,op.actor_id),'account_credentials',op.target_id,'UPDATE',jsonb_build_object('operation_id',p_id,'initiated_by',op.actor_id,'action',op.action,'status',result));
 return jsonb_build_object('status',result);
end $$;
revoke all on function public.finish_account_credential_change(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.finish_account_credential_change(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
