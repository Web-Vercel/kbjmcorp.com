-- Authenticated customer applications. Approval creates a prospect CRM record only.
-- Company membership, finance access, contracts, wallets and ad accounts require separate authorization.
begin;
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
commit;
