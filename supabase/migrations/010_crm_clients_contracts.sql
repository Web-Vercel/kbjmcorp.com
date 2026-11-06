-- Single-agency CRM: business records, explicit phone invitations and contract register.
begin;
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
commit;
