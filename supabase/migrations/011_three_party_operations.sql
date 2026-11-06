-- Operating roles are application responsibilities, not verified legal entities or media credentials.
begin;
create table public.operating_units (
 code text primary key, label text not null, country text not null, kind text not null check(kind in ('fulfilment','market')),
 active boolean not null default true
);
insert into public.operating_units(code,label,country,kind) values('kbjm_ca','KBJM · Canada fulfilment','CA','fulfilment'),('zhidian_cn','智点未来 · China market operations','CN','market');
create table public.staff_unit_roles (
 user_id uuid not null references public.staff_members(user_id), unit_code text not null references public.operating_units(code),
 role text not null check(role in ('ad_operations','customer_service','finance_preparer','finance_reviewer')),
 active boolean not null default true, assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(),
 primary key(user_id,unit_code,role),
 check((unit_code='kbjm_ca' and role='ad_operations') or (unit_code='zhidian_cn' and role in ('customer_service','finance_preparer','finance_reviewer')))
);
create table public.client_operating_links (
 organization_id uuid primary key references public.organizations(id),
 fulfilment_unit text not null default 'kbjm_ca' references public.operating_units(code),
 market_unit text not null default 'zhidian_cn' references public.operating_units(code),
 check(fulfilment_unit='kbjm_ca' and market_unit='zhidian_cn')
);
insert into public.client_operating_links(organization_id) select id from public.organizations;
create function public.link_default_operating_units() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.client_operating_links(organization_id) values(NEW.id); return NEW; end;
$$;
revoke all on function public.link_default_operating_units() from public,anon,authenticated;
create trigger link_operating_units after insert on public.organizations for each row execute function public.link_default_operating_units();
alter table public.operating_units enable row level security;
alter table public.staff_unit_roles enable row level security;
alter table public.client_operating_links enable row level security;
revoke all on public.operating_units,public.staff_unit_roles,public.client_operating_links from public,anon,authenticated;
grant select on public.operating_units,public.staff_unit_roles to authenticated;
grant select,insert,update,delete on public.operating_units,public.staff_unit_roles,public.client_operating_links to service_role;
create policy staff_operating_units on public.operating_units for select to authenticated using(exists(select 1 from public.staff_members where user_id=auth.uid() and active));
create policy own_operating_roles on public.staff_unit_roles for select to authenticated using(user_id=auth.uid());

create function public.has_ops_capability(p_cap text,p_org uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and
 (s.role='admin' or (s.role='operator' and exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code
 where r.user_id=s.user_id and r.active and u.active and
 ((p_cap in ('source.read','source.submit','account.link') and r.role='ad_operations')
 or (p_cap='finance.read' and r.role in ('finance_preparer','finance_reviewer'))
 or (p_cap='finance.prepare' and r.role='finance_preparer') or (p_cap='finance.review' and r.role='finance_reviewer')
 or (p_cap='support.handle' and r.role='customer_service') or (p_cap='client.read'))
 and (p_org is null or exists(select 1 from public.client_operating_links l where l.organization_id=p_org and
 ((u.kind='fulfilment' and l.fulfilment_unit=u.code) or (u.kind='market' and l.market_unit=u.code))))))));
$$;
revoke all on function public.has_ops_capability(text,uuid) from public,anon;
grant execute on function public.has_ops_capability(text,uuid) to authenticated;
-- Compatibility for the original China CRM: unassigned or Canadian operators get no legacy CRM rights.
create or replace function public.has_staff_access(p_roles text[] default array['admin','operator']::text[]) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.staff_members s where s.user_id=auth.uid() and s.active and s.role=any(p_roles)
 and (s.role='admin' or exists(select 1 from public.staff_unit_roles r join public.operating_units u on u.code=r.unit_code where r.user_id=s.user_id and r.active and u.active and r.unit_code='zhidian_cn' and r.role='customer_service')));
$$;
create policy ops_organizations on public.organizations for select to authenticated using(public.has_ops_capability('client.read',id));
create policy canada_accounts on public.ad_accounts for select to authenticated using(public.has_ops_capability('source.read',organization_id));
create policy finance_accounts on public.ad_accounts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_wallets on public.client_wallets for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_entries on public.wallet_entries for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_topups on public.client_topups for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_reports on public.monthly_ad_reports for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy ops_finance_contracts on public.client_contracts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create policy finance_rate_sources on public.billing_fx_quotes for select to authenticated using(public.has_ops_capability('finance.read'));

create function public.get_ops_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('owner',public.has_staff_access(array['admin']::text[]),'roles',coalesce((select jsonb_agg(jsonb_build_object('unit',r.unit_code,'role',r.role)) from public.staff_unit_roles r join public.staff_members s on s.user_id=r.user_id join public.operating_units u on u.code=r.unit_code where r.user_id=auth.uid() and r.active and s.active and u.active and coalesce(auth.jwt()->>'aal','')='aal2'),'[]'::jsonb),
 'canSource',public.has_ops_capability('source.submit'),'canPrepare',public.has_ops_capability('finance.prepare'),'canReview',public.has_ops_capability('finance.review'),'canSupport',public.has_ops_capability('support.handle'));
$$;
create function public.assign_operating_role(p_user uuid,p_unit text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.staff_members where user_id=p_user and active and role='operator') then raise exception 'Existing active staff operator required' using errcode='22023'; end if;
 insert into public.staff_unit_roles(user_id,unit_code,role,active,assigned_by) values(p_user,p_unit,p_role,p_active,auth.uid()) on conflict(user_id,unit_code,role) do update set active=excluded.active,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'operating_role',p_user,'UPDATE',jsonb_build_object('unit',p_unit,'role',p_role,'active',p_active));
end;
$$;
create function public.list_operating_staff() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',s.user_id,'role',s.role,'active',s.active,'assignments',coalesce((select jsonb_agg(jsonb_build_object('unit',r.unit_code,'role',r.role,'active',r.active)) from public.staff_unit_roles r where r.user_id=s.user_id),'[]'::jsonb))) from public.staff_members s),'[]'::jsonb);
end;
$$;
create function public.ops_link_account(p_org uuid,p_external_id text,p_label text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_ops_capability('account.link',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 if char_length(btrim(p_external_id)) not between 1 and 160 or p_external_id !~ '^[a-zA-Z0-9._:-]+$' then raise exception 'Invalid account identity' using errcode='22023'; end if;
 insert into public.ad_accounts(organization_id,platform,external_id,label) values(p_org,'openai_ads',p_external_id,btrim(p_label)) returning id into result;
 return result;
end;
$$;
create table public.ops_source_packets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 ad_account_id uuid not null, period date not null check(extract(day from period)=1), version integer not null,
 source_currency text not null check(source_currency in ('CAD','USD')), source_timezone text not null check(char_length(source_timezone) between 1 and 80), source_language text not null check(source_language in ('en','zh','other')),
 source_amount_minor bigint not null check(source_amount_minor between 0 and 9999999999),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 180),
 source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 status text not null default 'submitted' check(status in ('submitted','needs_correction','under_review','ready_for_publication','superseded')),
 source_feedback text not null default '' check(char_length(source_feedback)<=1000),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id), unique(ad_account_id,period,version)
);
create table public.ops_reconciliations (
 id uuid primary key default gen_random_uuid(), packet_id uuid not null references public.ops_source_packets(id), revision integer not null,
 fx_quote_id uuid not null references public.billing_fx_quotes(id), settlement_date date not null,
 ad_spend_cny_minor bigint not null check(ad_spend_cny_minor between 0 and 9999999999),
 fee_minor bigint not null check(fee_minor between 0 and 9999999999), fee_basis_points integer not null check(fee_basis_points between 0 and 10000),
 fee_agreement_reference text check(char_length(fee_agreement_reference)<=180),
 status text not null default 'pending' check(status in ('pending','approved','rejected','superseded')),
 prepared_by uuid not null references auth.users(id), prepared_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text check(char_length(review_note)<=1000),
 check(reviewed_by is null or reviewed_by<>prepared_by), unique(packet_id,revision)
);
alter table public.ops_source_packets enable row level security;
alter table public.ops_reconciliations enable row level security;
revoke all on public.ops_source_packets,public.ops_reconciliations from public,anon,authenticated;
grant select(id,organization_id,ad_account_id,period,version,source_currency,source_timezone,source_language,source_amount_minor,source_reference,source_sha256,status,source_feedback,submitted_at) on public.ops_source_packets to authenticated;
grant select(id,packet_id,revision,fx_quote_id,settlement_date,ad_spend_cny_minor,fee_minor,fee_basis_points,fee_agreement_reference,status,prepared_by,prepared_at,reviewed_at,review_note) on public.ops_reconciliations to authenticated;
grant select,insert,update on public.ops_source_packets,public.ops_reconciliations to service_role;
create policy source_handoff_read on public.ops_source_packets for select to authenticated using(public.has_ops_capability('source.read',organization_id) or public.has_ops_capability('finance.read',organization_id));
create policy finance_handoff_read on public.ops_reconciliations for select to authenticated using(exists(select 1 from public.ops_source_packets p where p.id=packet_id and public.has_ops_capability('finance.read',p.organization_id)));
create index ops_packet_org_date on public.ops_source_packets(organization_id,period desc);
create function public.submit_ops_source(p_org uuid,p_account uuid,p_period date,p_currency text,p_amount bigint,p_reference text,p_hash text,p_timezone text,p_language text) returns uuid language plpgsql security definer set search_path='' as $$
declare next_version integer; result uuid;
begin
 if not public.has_ops_capability('source.submit',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=p_account and organization_id=p_org for update;
 if not found then raise exception 'Account ownership mismatch' using errcode='22023'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid source timezone' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into next_version from public.ops_source_packets where ad_account_id=p_account and period=p_period;
 if next_version>100 then raise exception 'Revision limit' using errcode='54000'; end if;
 insert into public.ops_source_packets(organization_id,ad_account_id,period,version,source_currency,source_timezone,source_language,source_amount_minor,source_reference,source_sha256,submitted_by) values(p_org,p_account,p_period,next_version,p_currency,p_timezone,p_language,p_amount,btrim(p_reference),nullif(p_hash,''),auth.uid()) returning id into result;
 update public.ops_reconciliations set status='superseded',reviewed_at=now(),review_note='Source superseded by a newer revision' where status='pending' and packet_id in(select id from public.ops_source_packets where ad_account_id=p_account and period=p_period and version<next_version);
 update public.ops_source_packets set status='superseded' where ad_account_id=p_account and period=p_period and version<next_version;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_source',result,'INSERT',jsonb_build_object('organization_id',p_org,'version',next_version));
 return result;
end;
$$;
create function public.return_ops_source(p_packet uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare packet public.ops_source_packets%rowtype;
begin
 select * into packet from public.ops_source_packets where id=p_packet for update;
 if not found or not public.has_ops_capability('finance.read',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if packet.status not in ('submitted','needs_correction') then raise exception 'Source already under financial review' using errcode='40001'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 1000 then raise exception 'Source feedback required' using errcode='22023'; end if;
 update public.ops_source_packets set status='needs_correction',source_feedback=btrim(p_reason) where id=p_packet;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_source',p_packet,'UPDATE',jsonb_build_object('status','needs_correction'));
end;
$$;
create function public.prepare_ops_reconciliation(p_packet uuid,p_quote uuid,p_fee_bps integer,p_fee_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare packet public.ops_source_packets%rowtype; quote public.billing_fx_quotes%rowtype; result uuid; next_revision integer; converted numeric;
begin
 select * into packet from public.ops_source_packets where id=p_packet;
 if not found or not public.has_ops_capability('finance.prepare',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=packet.ad_account_id for update;
 select * into packet from public.ops_source_packets where id=p_packet for update;
 if exists(select 1 from public.ops_source_packets where ad_account_id=packet.ad_account_id and period=packet.period and version>packet.version) or packet.status not in ('submitted','under_review') then raise exception 'Stale or returned source' using errcode='40001'; end if;
 if packet.source_currency<>'CAD' then raise exception 'Verified CAD to CNY adapter required' using errcode='22023'; end if;
 select * into quote from public.billing_fx_quotes where id=p_quote;
 if not found or quote.is_demo or quote.value_date<>(now() at time zone 'Asia/Shanghai')::date or (quote.quoted_at at time zone 'Asia/Shanghai')::date<>quote.value_date or quote.quoted_at>now() then raise exception 'Current verified quote required' using errcode='22023'; end if;
 if p_fee_bps is null or p_fee_bps not between 0 and 10000 or (p_fee_bps>0 and char_length(btrim(coalesce(p_fee_reference,'')))<3) then raise exception 'Agreed fee evidence required' using errcode='22023'; end if;
 if exists(select 1 from public.ops_reconciliations where packet_id=p_packet and status in ('pending','approved')) then raise exception 'Financial review already exists' using errcode='40001'; end if;
 select coalesce(max(revision),0)+1 into next_revision from public.ops_reconciliations where packet_id=p_packet;
 converted:=round(packet.source_amount_minor::numeric*quote.cad_cny_rate::numeric,0);
 insert into public.ops_reconciliations(packet_id,revision,fx_quote_id,settlement_date,ad_spend_cny_minor,fee_minor,fee_basis_points,fee_agreement_reference,prepared_by) values(p_packet,next_revision,p_quote,quote.value_date,converted,round(converted*p_fee_bps/10000,0),p_fee_bps,nullif(btrim(p_fee_reference),''),auth.uid()) returning id into result;
 update public.ops_source_packets set status='under_review' where id=p_packet;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_reconciliation',result,'INSERT',jsonb_build_object('packet_id',p_packet,'revision',next_revision));
 return result;
end;
$$;
create function public.review_ops_reconciliation(p_id uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare reconciliation public.ops_reconciliations%rowtype; packet public.ops_source_packets%rowtype;
begin
 select * into reconciliation from public.ops_reconciliations where id=p_id;
 select * into packet from public.ops_source_packets where id=reconciliation.packet_id;
 if reconciliation.id is null or not public.has_ops_capability('finance.review',packet.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.ad_accounts where id=packet.ad_account_id for update;
 select * into reconciliation from public.ops_reconciliations where id=p_id for update;
 if reconciliation.status<>'pending' or exists(select 1 from public.ops_source_packets where ad_account_id=packet.ad_account_id and period=packet.period and version>packet.version) then raise exception 'Stale review' using errcode='40001'; end if;
 if reconciliation.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review decision and note required' using errcode='22023'; end if;
 if p_decision='approved' and reconciliation.settlement_date<>(now() at time zone 'Asia/Shanghai')::date then raise exception 'Quote expired; prepare a fresh revision' using errcode='22023'; end if;
 update public.ops_reconciliations set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) where id=p_id;
 update public.ops_source_packets set status=case when p_decision='approved' then 'ready_for_publication' else 'submitted' end where id=packet.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'ops_reconciliation',p_id,'UPDATE',jsonb_build_object('status',p_decision));
 -- No wallet debit, client report publication, bank payment or advertising API call occurs here.
end;
$$;
create function public.protect_ops_packet() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or (to_jsonb(OLD)-array['status','source_feedback']) is distinct from (to_jsonb(NEW)-array['status','source_feedback']) then raise exception 'Source versions are immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
create function public.protect_ops_reconciliation() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or OLD.status<>'pending' or NEW.status not in ('approved','rejected','superseded') or (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_note']) is distinct from (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_note']) then raise exception 'Reconciliation revisions are immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
revoke all on function public.protect_ops_packet(),public.protect_ops_reconciliation() from public,anon,authenticated;
create trigger immutable_ops_source before update or delete on public.ops_source_packets for each row execute function public.protect_ops_packet();
create trigger immutable_ops_reconciliation before update or delete on public.ops_reconciliations for each row execute function public.protect_ops_reconciliation();

create table public.service_requests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 category text not null check(category in ('account','report','billing','other')),
 subject text not null check(char_length(btrim(subject)) between 3 and 160),
 status text not null default 'open' check(status in ('open','in_progress','resolved')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.service_request_messages (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.service_requests(id),
 body text not null check(char_length(btrim(body)) between 3 and 1500),
 author_id uuid not null references auth.users(id),author_role text not null check(author_role in ('client','staff')),
 created_at timestamptz not null default now()
);
alter table public.service_requests enable row level security;
alter table public.service_request_messages enable row level security;
revoke all on public.service_requests,public.service_request_messages from public,anon,authenticated;
grant select(id,organization_id,category,subject,status,created_at,updated_at) on public.service_requests to authenticated;
grant select(id,request_id,body,author_role,created_at) on public.service_request_messages to authenticated;
grant select,insert,update on public.service_requests,public.service_request_messages to service_role;
create index service_request_org_date on public.service_requests(organization_id,updated_at desc);
create index service_messages_request on public.service_request_messages(request_id,created_at);
create function public.can_read_service_request(p_org uuid,p_category text) returns boolean language sql stable security definer set search_path='' as $$
 select (case when p_category='billing' then public.has_ops_capability('finance.read',p_org) else public.has_ops_capability('support.handle',p_org) end)
 or (not exists(select 1 from public.staff_members where user_id=auth.uid()) and exists(select 1 from public.memberships where organization_id=p_org and user_id=auth.uid()) and (p_category<>'billing' or public.has_finance_access(p_org)));
$$;
revoke all on function public.can_read_service_request(uuid,text) from public,anon;
grant execute on function public.can_read_service_request(uuid,text) to authenticated;
create policy scoped_service_requests on public.service_requests for select to authenticated using(public.can_read_service_request(organization_id,category));
create policy scoped_service_messages on public.service_request_messages for select to authenticated using(exists(select 1 from public.service_requests r where r.id=request_id));
create function public.create_service_request(p_org uuid,p_category text,p_subject text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or exists(select 1 from public.staff_members where user_id=auth.uid()) or not public.can_read_service_request(p_org,p_category) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 if (select count(*) from public.service_requests where organization_id=p_org and status<>'resolved')>=20 then raise exception 'Open request limit' using errcode='54000'; end if;
 insert into public.service_requests(organization_id,category,subject,created_by) values(p_org,p_category,btrim(p_subject),auth.uid()) returning id into result;
 insert into public.service_request_messages(request_id,body,author_id,author_role) values(result,btrim(p_body),auth.uid(),'client');
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',result,'INSERT',jsonb_build_object('organization_id',p_org,'category',p_category));
 return result;
end;
$$;
create function public.reply_service_request(p_id uuid,p_body text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare request public.service_requests%rowtype; staff boolean;
begin
 select * into request from public.service_requests where id=p_id for update;
 if not found or not public.can_read_service_request(request.organization_id,request.category) then raise exception 'Forbidden' using errcode='42501'; end if;
 if (select count(*) from public.service_request_messages where request_id=p_id)>=200 then raise exception 'Message limit' using errcode='54000'; end if;
 staff:=exists(select 1 from public.staff_members where user_id=auth.uid());
 insert into public.service_request_messages(request_id,body,author_id,author_role) values(p_id,btrim(p_body),auth.uid(),case when staff then 'staff' else 'client' end);
 update public.service_requests set status=case when staff then p_status when status='resolved' then 'open' else status end,updated_at=now() where id=p_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'service_request',p_id,'UPDATE',jsonb_build_object('status',case when staff then p_status else 'client_reply' end));
end;
$$;
create function public.get_ops_wallet_summary(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'currency',w.currency,'balance_minor',coalesce((select sum(e.amount_minor) from public.wallet_entries e where e.wallet_id=w.id),0)::text,'pending_topups',(select count(*) from public.client_topups t where t.wallet_id=w.id and t.status='pending'))) from public.client_wallets w where w.organization_id=p_org),'[]'::jsonb);
end;
$$;
revoke all on function public.get_ops_wallet_summary(uuid) from public,anon;
grant execute on function public.get_ops_wallet_summary(uuid) to authenticated;
revoke all on function public.get_ops_context(),public.assign_operating_role(uuid,text,text,boolean),public.list_operating_staff(),public.ops_link_account(uuid,text,text),public.submit_ops_source(uuid,uuid,date,text,bigint,text,text,text,text),public.return_ops_source(uuid,text),public.prepare_ops_reconciliation(uuid,uuid,integer,text),public.review_ops_reconciliation(uuid,text,text),public.create_service_request(uuid,text,text,text),public.reply_service_request(uuid,text,text) from public,anon;
grant execute on function public.get_ops_context(),public.assign_operating_role(uuid,text,text,boolean),public.list_operating_staff(),public.ops_link_account(uuid,text,text),public.submit_ops_source(uuid,uuid,date,text,bigint,text,text,text,text),public.return_ops_source(uuid,text),public.prepare_ops_reconciliation(uuid,uuid,integer,text),public.review_ops_reconciliation(uuid,text,text),public.create_service_request(uuid,text,text,text),public.reply_service_request(uuid,text,text) to authenticated;
commit;
