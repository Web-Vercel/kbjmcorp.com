-- Investor-only password sign-in. Existing credential/session gates and read-only roles remain intact.
begin;
create or replace function public.require_live_account(p_mfa boolean default true) returns public.live_access_accounts language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;u jsonb;sid uuid;started timestamptz;
begin
 select * into a from public.live_access_accounts where user_id=auth.uid();
 if not found or not a.active or not public.account_credential_session_valid() or (p_mfa and a.role not in ('client','investor') and coalesce(auth.jwt()->>'aal','')<>'aal2') then raise exception 'Account unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(v) into u from auth.users v where v.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Account unavailable' using errcode='42501';end if;
 if exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting account grants' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then raise exception 'Fresh sign-in required' using errcode='42501';end;
 select s.created_at into started from auth.sessions s where s.id=sid and s.user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;
 return a;
end $$;
notify pgrst, 'reload schema';
commit;
