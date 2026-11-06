-- Phase 1: verified bank receipts, independent approval and atomic CNY ledger posting.
-- No bank API, online payment, cash transfer or synthetic receipt is executed.
begin;
create table public.collection_accounts (
 id uuid primary key default gen_random_uuid(), legal_name text not null check(char_length(btrim(legal_name)) between 2 and 180),
 bank_name text not null check(char_length(btrim(bank_name)) between 2 and 180),
 account_number text not null check(account_number ~ '^[0-9A-Za-z -]{6,50}$'),
 currency text not null default 'CNY' check(currency='CNY'),
 verification_reference text not null check(char_length(btrim(verification_reference)) between 3 and 180),
 active boolean not null default true, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(bank_name,account_number)
);
create table public.wallet_collection_accounts (
 wallet_id uuid primary key references public.client_wallets(id), collection_account_id uuid not null references public.collection_accounts(id),
 agreement_reference text not null check(char_length(btrim(agreement_reference)) between 3 and 180), assigned_by uuid not null references auth.users(id), assigned_at timestamptz not null default now()
);
create table public.bank_receipts (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null default 'CNY' check(currency='CNY'),
 collection_account_id uuid not null references public.collection_accounts(id), topup_id uuid references public.client_topups(id),
 amount_minor bigint not null check(amount_minor between 1 and 9999999999), payer_name text not null check(char_length(btrim(payer_name)) between 2 and 180),
 bank_reference text not null check(char_length(btrim(bank_reference)) between 3 and 120),
 bank_reference_normalized text generated always as (upper(regexp_replace(bank_reference,'[[:space:]]','','g'))) stored, booked_date date not null,
 evidence_reference text not null check(char_length(btrim(evidence_reference)) between 3 and 180),
 status text not null default 'pending' check(status in ('pending','credited','rejected')),
 prepared_by uuid not null references auth.users(id), prepared_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text,
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 check(reviewed_by is null or reviewed_by<>prepared_by)
);
create unique index one_active_bank_transaction on public.bank_receipts(collection_account_id,bank_reference_normalized) where status<>'rejected';
create unique index one_receipt_per_topup on public.bank_receipts(topup_id) where topup_id is not null and status<>'rejected';
alter table public.collection_accounts enable row level security;
alter table public.wallet_collection_accounts enable row level security;
alter table public.bank_receipts enable row level security;
revoke all on public.collection_accounts,public.wallet_collection_accounts,public.bank_receipts from public,anon,authenticated;
grant select on public.collection_accounts,public.wallet_collection_accounts to authenticated;
grant select(id,wallet_id,organization_id,currency,collection_account_id,topup_id,amount_minor,payer_name,bank_reference,booked_date,evidence_reference,status,prepared_by,prepared_at,reviewed_at,review_note) on public.bank_receipts to authenticated;
grant select,insert,update on public.collection_accounts,public.wallet_collection_accounts,public.bank_receipts to service_role;
create policy finance_collection_accounts on public.collection_accounts for select to authenticated using(public.has_ops_capability('finance.read'));
create policy finance_collection_links on public.wallet_collection_accounts for select to authenticated using(exists(select 1 from public.client_wallets w where w.id=wallet_id and public.has_ops_capability('finance.read',w.organization_id)));
create policy finance_bank_receipts on public.bank_receipts for select to authenticated using(public.has_ops_capability('finance.read',organization_id));
create function public.create_collection_account(p_legal text,p_bank text,p_number text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.collection_accounts(legal_name,bank_name,account_number,verification_reference,created_by) values(btrim(p_legal),btrim(p_bank),btrim(p_number),btrim(p_evidence),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'collection_account',result,'INSERT','{"verified_manually":true}'::jsonb);
 return result;
end;
$$;
create function public.assign_collection_account(p_wallet uuid,p_account uuid,p_agreement text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.client_wallets where id=p_wallet and currency='CNY') or not exists(select 1 from public.collection_accounts where id=p_account and active) then raise exception 'Active CNY collection account required' using errcode='22023'; end if;
 insert into public.wallet_collection_accounts(wallet_id,collection_account_id,agreement_reference,assigned_by) values(p_wallet,p_account,btrim(p_agreement),auth.uid()) on conflict(wallet_id) do update set collection_account_id=excluded.collection_account_id,agreement_reference=excluded.agreement_reference,assigned_by=auth.uid(),assigned_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'wallet_collection',p_wallet,'UPDATE',jsonb_build_object('account_id',p_account));
end;
$$;
create function public.set_collection_account_active(p_account uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.has_staff_access(array['admin']::text[]) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_active is null then raise exception 'Status required' using errcode='22023'; end if;
 update public.collection_accounts set active=p_active where id=p_account;
 if not found then raise exception 'Account unavailable' using errcode='22023'; end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'collection_account',p_account,'UPDATE',jsonb_build_object('active',p_active));
end;
$$;
create function public.get_collection_instructions(p_wallet uuid) returns table(legal_name text,bank_name text,account_number text,currency text,agreement_reference text) language sql stable security definer set search_path='' as $$
 select a.legal_name,a.bank_name,a.account_number,a.currency,l.agreement_reference from public.wallet_collection_accounts l join public.collection_accounts a on a.id=l.collection_account_id join public.client_wallets w on w.id=l.wallet_id where w.id=p_wallet and a.active and public.has_finance_access(w.organization_id);
$$;
create function public.prepare_bank_receipt(p_wallet uuid,p_topup uuid,p_amount bigint,p_payer text,p_bank_reference text,p_booked date,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare w public.client_wallets%rowtype; account uuid; result uuid;
begin
 select * into w from public.client_wallets where id=p_wallet for update;
 if not found or not public.has_ops_capability('finance.prepare',w.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select a.id into account from public.wallet_collection_accounts l join public.collection_accounts a on a.id=l.collection_account_id where l.wallet_id=p_wallet and a.active for share of l,a;
 if account is null or w.currency<>'CNY' then raise exception 'Verified collection instructions required' using errcode='22023'; end if;
 if p_booked is null or p_booked>(now() at time zone 'Asia/Shanghai')::date then raise exception 'Actual booked date required' using errcode='22023'; end if;
 if p_topup is not null and not exists(select 1 from public.client_topups where id=p_topup and wallet_id=p_wallet and amount_minor=p_amount and status='pending' and currency='CNY') then raise exception 'Topup does not match receipt' using errcode='22023'; end if;
 insert into public.bank_receipts(wallet_id,organization_id,collection_account_id,topup_id,amount_minor,payer_name,bank_reference,booked_date,evidence_reference,prepared_by) values(w.id,w.organization_id,account,p_topup,p_amount,btrim(p_payer),btrim(p_bank_reference),p_booked,btrim(p_evidence),auth.uid()) returning id into result;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'bank_receipt',result,'INSERT',jsonb_build_object('wallet_id',w.id));
 return result;
end;
$$;
create function public.review_bank_receipt(p_receipt uuid,p_decision text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.bank_receipts%rowtype;
begin
 select * into r from public.bank_receipts where id=p_receipt;
 if not found or not public.has_ops_capability('finance.review',r.organization_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 -- Lock wallet before receipt, matching preparation's lock order.
 perform 1 from public.client_wallets where id=r.wallet_id for update;
 select * into r from public.bank_receipts where id=p_receipt for update;
 if r.prepared_by=auth.uid() then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 if p_decision is null or p_decision not in ('credited','rejected') or p_note is null or char_length(btrim(p_note)) not between 3 and 1000 then raise exception 'Review decision and note required' using errcode='22023'; end if;
 -- Same decision retries succeed without a second posting; conflicting retries fail.
 if r.status<>'pending' then
  if r.status=p_decision then return; end if;
  raise exception 'Receipt already reviewed' using errcode='40001';
 end if;
 if p_decision='credited' then
  perform 1 from public.collection_accounts where id=r.collection_account_id and active for share;
  if not found then raise exception 'Collection account paused' using errcode='22023'; end if;
  if r.topup_id is not null then
   perform 1 from public.client_topups where id=r.topup_id and wallet_id=r.wallet_id and amount_minor=r.amount_minor and status='pending' for update;
   if not found then raise exception 'Topup no longer pending' using errcode='40001'; end if;
  end if;
  insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values(r.wallet_id,r.organization_id,'CNY','topup',r.amount_minor,'对公转账到账 / Verified bank receipt','bank-receipt:'||r.id::text);
  if r.topup_id is not null then update public.client_topups set status='credited' where id=r.topup_id; end if;
 end if;
 update public.bank_receipts set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=btrim(p_note) where id=r.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(auth.uid(),'bank_receipt',r.id,'UPDATE',jsonb_build_object('status',p_decision));
end;
$$;
create function public.protect_bank_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or OLD.status<>'pending' or NEW.status not in ('credited','rejected') or (to_jsonb(OLD)-array['status','reviewed_by','reviewed_at','review_note','bank_reference_normalized']) is distinct from (to_jsonb(NEW)-array['status','reviewed_by','reviewed_at','review_note','bank_reference_normalized']) then raise exception 'Receipt evidence is immutable' using errcode='42501'; end if;
 return NEW;
end;
$$;
create trigger immutable_bank_receipt before update or delete on public.bank_receipts for each row execute function public.protect_bank_receipt();
create function public.protect_collection_account() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='DELETE' or (to_jsonb(OLD)-'active') is distinct from (to_jsonb(NEW)-'active') then raise exception 'Collection account identity is immutable; create a new account' using errcode='42501'; end if;
 return NEW;
end;
$$;
create trigger immutable_collection_identity before update or delete on public.collection_accounts for each row execute function public.protect_collection_account();
revoke all on function public.protect_bank_receipt(),public.protect_collection_account() from public,anon,authenticated;
revoke all on function public.create_collection_account(text,text,text,text),public.assign_collection_account(uuid,uuid,text),public.set_collection_account_active(uuid,boolean),public.get_collection_instructions(uuid),public.prepare_bank_receipt(uuid,uuid,bigint,text,text,date,text),public.review_bank_receipt(uuid,text,text) from public,anon;
grant execute on function public.create_collection_account(text,text,text,text),public.assign_collection_account(uuid,uuid,text),public.set_collection_account_active(uuid,boolean),public.get_collection_instructions(uuid),public.prepare_bank_receipt(uuid,uuid,bigint,text,text,date,text),public.review_bank_receipt(uuid,text,text) to authenticated;
commit;
