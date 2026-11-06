-- Separate agency prepayment ledger. No payment gateway or provider API is enabled.
begin;
create table public.finance_access (
 organization_id uuid not null, user_id uuid not null,
 role text not null check(role in ('viewer','manager')),
 primary key(organization_id,user_id),
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table public.finance_access enable row level security;
revoke all on public.finance_access from public,anon,authenticated;
grant select on public.finance_access to authenticated;
grant select,insert,update,delete on public.finance_access to service_role;
create policy own_finance_access on public.finance_access for select to authenticated using(user_id=(select auth.uid()));
create function public.has_finance_access(p_org uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.finance_access f join public.memberships m using(organization_id,user_id)
 where f.organization_id=p_org and f.user_id=auth.uid() and (not p_write or f.role='manager'));
$$;
revoke all on function public.has_finance_access(uuid,boolean) from public,anon;
grant execute on function public.has_finance_access(uuid,boolean) to authenticated;

create table public.client_wallets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 currency text not null check(currency in ('CAD','USD','CNY','EUR','GBP','AUD')),
 created_at timestamptz not null default now(), unique(organization_id,currency), unique(id,organization_id,currency)
);
create table public.monthly_ad_reports (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 ad_account_id uuid, source_account_name text not null default '' check(char_length(source_account_name)<=160),
 month date not null check(extract(day from month)=1), version integer not null default 1 check(version>0),
 ad_spend_minor bigint not null check(ad_spend_minor>=0 and ad_spend_minor<=9999999999),
 service_fee_minor bigint not null default 0 check(service_fee_minor>=0 and service_fee_minor<=9999999999),
 source_language text not null check(source_language in ('en','zh','other')),
 translation_status text not null default 'pending' check(translation_status in ('not_needed','pending','reviewed')),
 source_filename text not null check(char_length(source_filename) between 1 and 180),
 source_timezone text not null check(char_length(source_timezone) between 1 and 80),
 -- Private object identity; never returned to customers or embedded in public URLs.
 source_storage_key text, source_sha256 text check(source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 summary_zh text check(char_length(summary_zh)<=4000), summary_en text check(char_length(summary_en)<=4000),
 reviewed_by uuid references auth.users(id), published_at timestamptz,
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 foreign key(ad_account_id,organization_id) references public.ad_accounts(id,organization_id),
 unique(wallet_id,month,version),
 check(published_at is null or (source_storage_key is not null and source_sha256 is not null and reviewed_by is not null and ad_account_id is not null and nullif(btrim(source_account_name),'') is not null)),
 check(published_at is null or (source_language='zh' and translation_status='not_needed') or (translation_status='reviewed' and nullif(btrim(summary_zh),'') is not null))
);
create table public.monthly_ad_report_lines (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references public.monthly_ad_reports(id),
 campaign text not null check(char_length(campaign) between 1 and 160), market text not null check(char_length(market) between 1 and 120),
 impressions bigint check(impressions between 0 and 9999999999999), clicks bigint check(clicks between 0 and 9999999999999), spend_minor bigint not null check(spend_minor between 0 and 9999999999)
);
create table public.client_topups (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 amount_minor bigint not null check(amount_minor between 1 and 9999999999),
 reference text not null check(char_length(btrim(reference)) between 3 and 120),
 status text not null default 'pending' check(status in ('pending','credited','rejected')),
 requested_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 unique(wallet_id,reference)
);
create table public.wallet_entries (
 id uuid primary key default gen_random_uuid(), wallet_id uuid not null, organization_id uuid not null, currency text not null,
 kind text not null check(kind in ('topup','ad_spend','service_fee','refund','adjustment')),
 amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=9999999999),
 description text not null check(char_length(btrim(description)) between 2 and 240),
 source_reference text not null check(char_length(btrim(source_reference)) between 3 and 160),
 posted_at timestamptz not null default now(),
 foreign key(wallet_id,organization_id,currency) references public.client_wallets(id,organization_id,currency),
 unique(wallet_id,kind,source_reference),
 check((kind='topup' and amount_minor>0) or (kind in ('ad_spend','service_fee','refund') and amount_minor<0) or kind='adjustment')
);
create index wallet_entries_wallet_date on public.wallet_entries(wallet_id,posted_at desc);
create index monthly_reports_org_month on public.monthly_ad_reports(organization_id,month desc);
create index report_lines_report on public.monthly_ad_report_lines(report_id);
alter table public.client_wallets enable row level security;
alter table public.monthly_ad_reports enable row level security;
alter table public.monthly_ad_report_lines enable row level security;
alter table public.client_topups enable row level security;
alter table public.wallet_entries enable row level security;
revoke all on public.client_wallets,public.monthly_ad_reports,public.monthly_ad_report_lines,public.client_topups,public.wallet_entries from public,anon,authenticated;
grant select,insert,update,delete on public.client_wallets,public.monthly_ad_reports,public.monthly_ad_report_lines,public.client_topups to service_role;
grant select,insert on public.wallet_entries to service_role;
grant select on public.client_wallets to authenticated;
grant select(id,wallet_id,organization_id,currency,amount_minor,reference,status,created_at) on public.client_topups to authenticated;
grant select(id,wallet_id,kind,amount_minor,description,posted_at) on public.wallet_entries to authenticated;
grant select(id,wallet_id,organization_id,month,version,currency,ad_spend_minor,service_fee_minor,source_language,translation_status,source_filename,source_account_name,source_timezone,published_at,summary_zh,summary_en) on public.monthly_ad_reports to authenticated;
grant select on public.monthly_ad_report_lines to authenticated;
create policy finance_wallets on public.client_wallets for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_entries on public.wallet_entries for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_topups on public.client_topups for select to authenticated using(public.has_finance_access(organization_id));
create policy finance_reports on public.monthly_ad_reports for select to authenticated using(published_at is not null and public.has_finance_access(organization_id));
create policy finance_report_lines on public.monthly_ad_report_lines for select to authenticated using(exists(select 1 from public.monthly_ad_reports r where r.id=report_id));

create function public.get_client_wallets() returns table(id uuid,organization_id uuid,organization_name text,currency text,balance_minor text,credited_minor text,updated_at timestamptz,can_request boolean)
language sql stable security definer set search_path='' as $$
 select w.id,w.organization_id,o.name,w.currency,coalesce(sum(e.amount_minor),0)::text,
 coalesce(sum(e.amount_minor) filter(where e.kind='topup'),0)::text,max(e.posted_at),public.has_finance_access(w.organization_id,true)
 from public.client_wallets w join public.organizations o on o.id=w.organization_id left join public.wallet_entries e on e.wallet_id=w.id
 where public.has_finance_access(w.organization_id) group by w.id,o.name;
$$;
create function public.request_client_topup(p_wallet_id uuid,p_amount_minor bigint,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare w public.client_wallets%rowtype; result uuid;
begin
 select * into w from public.client_wallets where id=p_wallet_id for update;
 if not found or not public.has_finance_access(w.organization_id,true) then raise exception 'Forbidden' using errcode='42501'; end if;
 if (select count(*) from public.client_topups where wallet_id=p_wallet_id and status='pending')>=10 then raise exception 'Pending request limit' using errcode='54000'; end if;
 insert into public.client_topups(wallet_id,organization_id,currency,amount_minor,reference,requested_by)
 values(w.id,w.organization_id,w.currency,p_amount_minor,btrim(p_reference),auth.uid()) returning id into result;
 -- A request never credits the wallet. Settlement requires trusted verification.
 return result;
end;
$$;
revoke all on function public.get_client_wallets(),public.request_client_topup(uuid,bigint,text) from public,anon;
grant execute on function public.get_client_wallets(),public.request_client_topup(uuid,bigint,text) to authenticated;
-- Browser roles cannot post money, alter balances, settle topups or publish reports.
-- Trusted financial posting, corrections, source validation and private storage remain a separate implementation.
create function public.lock_posted_money() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Posted ledger entries are immutable; append a documented correction' using errcode='42501'; end;
$$;
revoke all on function public.lock_posted_money() from public,anon,authenticated;
create trigger immutable_money before update or delete on public.wallet_entries for each row execute function public.lock_posted_money();
create function public.protect_published_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP<>'INSERT' and OLD.published_at is not null then raise exception 'Published reports are immutable; create a new revision' using errcode='42501'; end if;
 if TG_OP='DELETE' then return OLD; end if;
 if NEW.published_at is not null then
  if not exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id)
   or (select coalesce(sum(spend_minor),0) from public.monthly_ad_report_lines where report_id=NEW.id)<>NEW.ad_spend_minor then
   raise exception 'Report lines must reconcile before publication' using errcode='23514';
  end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=NEW.source_timezone) then raise exception 'Invalid source timezone' using errcode='23514'; end if;
 end if;
 return NEW;
end;
$$;
revoke all on function public.protect_published_report() from public,anon,authenticated;
create trigger protect_report before insert or update or delete on public.monthly_ad_reports for each row execute function public.protect_published_report();
create function public.protect_report_lines() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_id uuid;
begin
 if TG_OP='UPDATE' and OLD.report_id<>NEW.report_id then raise exception 'Report identity cannot change' using errcode='42501'; end if;
 parent_id := case when TG_OP='DELETE' then OLD.report_id else NEW.report_id end;
 perform 1 from public.monthly_ad_reports where id=parent_id for update;
 if TG_OP<>'INSERT' and exists(select 1 from public.monthly_ad_reports where id=OLD.report_id and published_at is not null) then raise exception 'Published report lines are immutable' using errcode='42501'; end if;
 if TG_OP<>'DELETE' and exists(select 1 from public.monthly_ad_reports where id=NEW.report_id and published_at is not null) then raise exception 'Published report lines are immutable' using errcode='42501'; end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end;
$$;
revoke all on function public.protect_report_lines() from public,anon,authenticated;
create trigger protect_lines before insert or update or delete on public.monthly_ad_report_lines for each row execute function public.protect_report_lines();
commit;
