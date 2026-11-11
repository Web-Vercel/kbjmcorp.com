-- Real authenticated, organization-scoped accounts. No users, grants or money are seeded.
begin;
create table public.live_access_accounts(
 user_id uuid primary key references auth.users(id),organization_id uuid not null references public.organizations(id),
 role text not null check(role in ('investor','client','sales')),label text not null check(char_length(label) between 3 and 80),
 expected_email text not null check(char_length(expected_email) between 3 and 254),active boolean not null default false,
 revision integer not null default 1 check(revision>0),session_after timestamptz not null default clock_timestamp(),
 changed_by uuid not null references auth.users(id),changed_at timestamptz not null default now(),note text not null check(char_length(btrim(note)) between 3 and 1000)
);
create table public.live_sales_updates(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.live_access_accounts(user_id),organization_id uuid not null references public.organizations(id),request_id uuid not null,
 input_hash text not null,note text not null check(char_length(btrim(note)) between 3 and 1000),created_at timestamptz not null default now(),unique(user_id,request_id)
);
alter table public.live_access_accounts enable row level security;
alter table public.live_sales_updates enable row level security;
revoke all on public.live_access_accounts,public.live_sales_updates from public,anon,authenticated;
grant select on public.live_access_accounts to authenticated;
create policy admin_live_accounts on public.live_access_accounts for select to authenticated using(public.has_staff_access(array['admin']::text[]));
-- Keep these dedicated identities out of legacy broad employee/member grants.
create function public.guard_live_account_grants() returns trigger language plpgsql security definer set search_path='' as $$
begin if exists(select 1 from public.live_access_accounts where user_id=NEW.user_id) then raise exception 'Scoped account cannot receive legacy grants' using errcode='42501';end if;return NEW;end $$;
revoke all on function public.guard_live_account_grants() from public,anon,authenticated;
create trigger live_no_staff before insert or update on public.staff_members for each row execute function public.guard_live_account_grants();
create trigger live_no_membership before insert or update on public.memberships for each row execute function public.guard_live_account_grants();
create function public.set_live_account_access(p_user uuid,p_org uuid,p_role text,p_label text,p_email text,p_active boolean,p_revision integer,p_note text) returns integer language plpgsql security definer set search_path='' as $$
declare prior public.live_access_accounts%rowtype;u jsonb;r integer;
begin
 if not public.has_staff_access(array['admin']::text[]) or p_user=auth.uid() then raise exception 'Forbidden' using errcode='42501';end if;
 if p_role is null or p_role not in ('investor','client','sales') or p_label is null or char_length(btrim(p_label)) not between 3 and 80 or p_email is null or p_active is null or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Invalid account' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('live-access:'||p_user::text,0));
 select to_jsonb(a) into u from auth.users a where a.id=p_user;
 if u is null or lower(u->>'email') is distinct from lower(btrim(p_email)) or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null then raise exception 'Verified email user required' using errcode='22023';end if;
 if not exists(select 1 from public.organizations where id=p_org) or exists(select 1 from public.staff_members where user_id=p_user) or exists(select 1 from public.memberships where user_id=p_user) then raise exception 'Dedicated scoped identity required' using errcode='22023';end if;
 select * into prior from public.live_access_accounts where user_id=p_user for update;
 if found then
  if prior.organization_id<>p_org or prior.role<>p_role or prior.expected_email<>lower(btrim(p_email)) then raise exception 'Account scope is immutable' using errcode='22023';end if;
  if p_revision is distinct from prior.revision then raise exception 'Stale account revision' using errcode='40001';end if;
  update public.live_access_accounts set active=p_active,label=btrim(p_label),note=btrim(p_note),revision=revision+1,session_after=clock_timestamp(),changed_by=auth.uid(),changed_at=now() where user_id=p_user returning revision into r;
 else
  if p_revision is distinct from 0 then raise exception 'Stale account revision' using errcode='40001';end if;
  insert into public.live_access_accounts(user_id,organization_id,role,label,expected_email,active,changed_by,note) values(p_user,p_org,p_role,btrim(p_label),lower(btrim(p_email)),p_active,auth.uid(),btrim(p_note)) returning revision into r;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'live_account_access',p_user,'UPDATE',jsonb_build_object('organization_id',p_org,'role',p_role,'active',p_active,'revision',r));return r;
end $$;
revoke all on function public.set_live_account_access(uuid,uuid,text,text,text,boolean,integer,text) from public,anon;
grant execute on function public.set_live_account_access(uuid,uuid,text,text,text,boolean,integer,text) to authenticated;
create function public.require_live_account(p_mfa boolean default true) returns public.live_access_accounts language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;u jsonb;sid uuid;started timestamptz;
begin
 select * into a from public.live_access_accounts where user_id=auth.uid();
 if not found or not a.active or (p_mfa and coalesce(auth.jwt()->>'aal','')<>'aal2') then raise exception 'Account unavailable or verification required' using errcode='42501';end if;
 select to_jsonb(v) into u from auth.users v where v.id=a.user_id;
 if lower(u->>'email') is distinct from a.expected_email or nullif(u->>'email_confirmed_at','') is null or nullif(u->>'deleted_at','') is not null or coalesce(nullif(u->>'banned_until','')::timestamptz,'-infinity')>now() then raise exception 'Account unavailable' using errcode='42501';end if;
 if exists(select 1 from public.staff_members where user_id=a.user_id) or exists(select 1 from public.memberships where user_id=a.user_id) then raise exception 'Conflicting account grants' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then raise exception 'Fresh sign-in required' using errcode='42501';end;
 select s.created_at into started from auth.sessions s where s.id=sid and s.user_id=a.user_id;
 if started is null or started<a.session_after then raise exception 'Fresh sign-in required' using errcode='42501';end if;
 return a;
end $$;
revoke all on function public.require_live_account(boolean) from public,anon,authenticated;
create function public.get_live_account_context(p_mfa boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;begin a:=public.require_live_account(p_mfa);return jsonb_build_object('user_id',a.user_id,'organization_id',a.organization_id,'organization_name',(select name from public.organizations where id=a.organization_id),'role',a.role,'label',a.label,'revision',a.revision);end $$;
revoke all on function public.get_live_account_context(boolean) from public,anon;
grant execute on function public.get_live_account_context(boolean) to authenticated;
create function public.has_live_client_access(p_org uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;begin a:=public.require_live_account(true);return a.role='client' and a.organization_id=p_org;exception when others then return false;end $$;
revoke all on function public.has_live_client_access(uuid) from public,anon;
grant execute on function public.has_live_client_access(uuid) to authenticated;
create or replace function public.has_finance_access(p_org uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.live_access_accounts where user_id=auth.uid()) then public.has_live_client_access(p_org) else exists(select 1 from public.finance_access f join public.memberships m using(organization_id,user_id) where f.organization_id=p_org and f.user_id=auth.uid() and (not p_write or f.role='manager')) end;
$$;
-- Client questions/replies use the original audited service workflow; investor/sales cannot use it.
create or replace function public.can_read_service_request(p_org uuid,p_category text) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_ops_capability(case when p_category='billing' then 'finance.read' else 'support.handle' end,p_org)
 or (not exists(select 1 from public.staff_members where user_id=auth.uid()) and ((exists(select 1 from public.memberships where organization_id=p_org and user_id=auth.uid()) and (p_category<>'billing' or public.has_finance_access(p_org))) or public.has_live_client_access(p_org)));
$$;
create function public.get_live_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;wallets jsonb;statements jsonb;sources jsonb;profile jsonb;tickets jsonb;
begin
 a:=public.require_live_account(true);
 select jsonb_build_object('industry',industry,'country',country,'website',website,'status',status,'revision',revision,'notes',case when a.role='sales' then internal_notes else null end) into profile from public.client_profiles where organization_id=a.organization_id;
 if a.role<>'sales' then
 select coalesce(jsonb_agg(v),'[]') into wallets from (select w.id,w.currency,coalesce(sum(e.amount_minor),0)::text balance_minor from public.client_wallets w left join public.wallet_entries e on e.wallet_id=w.id where w.organization_id=a.organization_id group by w.id) v;
 select coalesce(jsonb_agg(v),'[]') into statements from (select id,wallet_id,month,total_cny_minor::text,upstream_cny_minor::text,service_cny_minor::text,summary_zh,usage,published_at from public.monthly_client_statements where organization_id=a.organization_id order by month desc,published_at desc limit 20) v;
 end if;
 if a.role='investor' then
 select coalesce(jsonb_agg(v),'[]') into sources from (select s.id,s.account_name,s.currency,s.since,s.until,s.check_status,s.period_spend_micros::text from public.ads_source_handoffs h join public.ads_reporting_bindings b on b.id=h.binding_id join public.ads_reporting_snapshots s on s.id=h.snapshot_id where b.organization_id=a.organization_id and b.active order by h.shared_at desc limit 10) v;
 end if;
 if a.role='sales' then select coalesce(jsonb_agg(v),'[]') into tickets from (select r.id,r.subject,r.status,r.category,r.updated_at,(select coalesce(jsonb_agg(m),'[]') from (select body,author_role,created_at from public.service_request_messages where request_id=r.id order by created_at desc limit 10)m) messages from public.service_requests r where r.organization_id=a.organization_id and r.category<>'billing' order by r.updated_at desc limit 20)v;end if;
 return jsonb_build_object('context',public.get_live_account_context(),'profile',profile,'wallets',coalesce(wallets,'[]'),'statements',coalesce(statements,'[]'),'sources',coalesce(sources,'[]'),'tickets',coalesce(tickets,'[]'));
end $$;
revoke all on function public.get_live_workspace() from public,anon;
grant execute on function public.get_live_workspace() to authenticated;
create function public.save_live_sales_followup(p_request uuid,p_revision integer,p_status text,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;prior public.live_sales_updates%rowtype;digest text;result uuid;
begin
 perform 1 from public.live_access_accounts where user_id=auth.uid() for share;a:=public.require_live_account(true);
 if a.role<>'sales' then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 or p_status is null or p_status not in ('prospect','onboarding','active','paused','closed') then raise exception 'Invalid follow-up' using errcode='22023';end if;
 digest:=encode(sha256(convert_to(jsonb_build_array(p_revision,p_status,btrim(p_note))::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));select * into prior from public.live_sales_updates where user_id=auth.uid() and request_id=p_request;
 if found then if prior.input_hash<>digest then raise exception 'Request conflict' using errcode='40001';end if;return prior.id;end if;
 update public.client_profiles set status=p_status,internal_notes=case when internal_notes='' then btrim(p_note) else internal_notes||E'\n'||btrim(p_note) end,revision=revision+1,updated_at=now() where organization_id=a.organization_id and revision=p_revision;
 if not found then raise exception 'Stale client revision or missing profile' using errcode='40001';end if;
 insert into public.live_sales_updates(user_id,organization_id,request_id,input_hash,note) values(a.user_id,a.organization_id,p_request,digest,btrim(p_note)) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'live_sales_followup',result,'INSERT',jsonb_build_object('organization_id',a.organization_id,'status',p_status));return result;
end $$;
revoke all on function public.save_live_sales_followup(uuid,integer,text,text) from public,anon;
grant execute on function public.save_live_sales_followup(uuid,integer,text,text) to authenticated;
create function public.reply_live_customer_service(p_ticket uuid,p_request uuid,p_status text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;r public.service_requests%rowtype;prior public.service_request_messages%rowtype;digest text;result uuid;
begin
 perform 1 from public.live_access_accounts where user_id=auth.uid() for share;a:=public.require_live_account(true);
 if a.role<>'sales' then raise exception 'Forbidden' using errcode='42501';end if;
 if p_request is null or p_body is null or char_length(btrim(p_body)) not between 3 and 1500 or p_status is null or p_status not in ('open','in_progress','resolved') then raise exception 'Invalid reply' using errcode='22023';end if;
 select * into r from public.service_requests where id=p_ticket and organization_id=a.organization_id and category<>'billing' for update;
 if not found then raise exception 'Forbidden' using errcode='42501';end if;
 digest:=encode(sha256(convert_to(jsonb_build_array(btrim(p_body),p_status)::text,'UTF8')),'hex');
 select * into prior from public.service_request_messages where author_id=auth.uid() and reply_request_key=p_request;
 if found then if prior.request_id<>p_ticket or prior.reply_input_sha256<>digest then raise exception 'Request conflict' using errcode='40001';end if;return prior.id;end if;
 if (select count(*) from public.service_request_messages where request_id=p_ticket)>=100 then raise exception 'Reply limit' using errcode='54000';end if;
 update public.service_requests set status=p_status,updated_at=now() where id=p_ticket;
 insert into public.service_request_messages(request_id,body,author_id,author_role,reply_request_key,reply_input_sha256,reply_result_status) values(p_ticket,btrim(p_body),auth.uid(),'staff',p_request,digest,p_status) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'live_service_reply',result,'INSERT',jsonb_build_object('organization_id',a.organization_id,'request_id',p_ticket,'status',p_status));return result;
end $$;
revoke all on function public.reply_live_customer_service(uuid,uuid,text,text) from public,anon;
grant execute on function public.reply_live_customer_service(uuid,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
