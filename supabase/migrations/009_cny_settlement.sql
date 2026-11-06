-- New client settlement policy: CNY principal, CAD source spend, no automatic FX markup; agreed agency fees only.
-- Historical accounts/statements are not rewritten or converted in place.
begin;
create table public.billing_fx_quotes (
 id uuid primary key default gen_random_uuid(),
 cad_cny_rate text not null check(cad_cny_rate ~ '^[0-9]{1,6}(\.[0-9]{1,8})?$' and cad_cny_rate::numeric>0),
 value_date date not null, quoted_at timestamptz not null,
 source_name text not null check(char_length(btrim(source_name)) between 2 and 180),
 is_demo boolean not null default false
);
alter table public.billing_fx_quotes enable row level security;
revoke all on public.billing_fx_quotes from public,anon,authenticated;
grant select,insert on public.billing_fx_quotes to service_role;
grant select on public.billing_fx_quotes to authenticated;
create trigger immutable_fx_quote before update or delete on public.billing_fx_quotes for each row execute function public.lock_posted_money();
alter table public.monthly_ad_reports add column source_currency text check(source_currency is null or source_currency='CAD');
alter table public.monthly_ad_reports add column source_ad_spend_minor bigint check(source_ad_spend_minor between 0 and 9999999999);
alter table public.monthly_ad_reports add column fx_quote_id uuid references public.billing_fx_quotes(id);
alter table public.monthly_ad_reports add column settlement_date date;
alter table public.monthly_ad_reports add column fee_basis_points integer not null default 0 check(fee_basis_points between 0 and 10000);
alter table public.monthly_ad_reports add column fee_agreement_reference text check(char_length(btrim(fee_agreement_reference)) between 3 and 180);
alter table public.client_wallets alter column currency set default 'CNY';
alter table public.monthly_ad_report_lines add column source_cad_minor bigint check(source_cad_minor between 0 and 9999999999);
grant select(source_currency,source_ad_spend_minor,fx_quote_id,settlement_date,fee_basis_points,fee_agreement_reference) on public.monthly_ad_reports to authenticated;
-- A quote is visible only with a published statement the customer can read.
create policy report_fx_quote on public.billing_fx_quotes for select to authenticated using(exists(select 1 from public.monthly_ad_reports r where r.fx_quote_id=billing_fx_quotes.id));
create function public.validate_cny_statement() returns trigger language plpgsql security definer set search_path='' as $$
declare quote public.billing_fx_quotes%rowtype; converted numeric; fee numeric;
begin
 if NEW.published_at is null or NEW.currency<>'CNY' then return NEW; end if;
 if NEW.source_currency is distinct from 'CAD' or NEW.source_ad_spend_minor is null or NEW.settlement_date is null or NEW.fx_quote_id is null then raise exception 'CAD source and locked settlement quote required' using errcode='23514'; end if;
 select * into quote from public.billing_fx_quotes where id=NEW.fx_quote_id;
 if not found or quote.is_demo or quote.value_date<>NEW.settlement_date then raise exception 'Current settlement date quote required; demo rates are not publishable' using errcode='23514'; end if;
 if (quote.quoted_at at time zone 'Asia/Shanghai')::date<>NEW.settlement_date then raise exception 'Quote must be recorded on the settlement day' using errcode='23514'; end if;
 if NEW.published_at<quote.quoted_at then raise exception 'Quote must precede confirmation' using errcode='23514'; end if;
 if (NEW.published_at at time zone 'Asia/Shanghai')::date<>NEW.settlement_date then raise exception 'Confirmation day must match locked settlement day' using errcode='23514'; end if;
 if exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id and source_cad_minor is null)
 or (select coalesce(sum(source_cad_minor),0) from public.monthly_ad_report_lines where report_id=NEW.id)<>NEW.source_ad_spend_minor then raise exception 'Original CAD detail must reconcile' using errcode='23514'; end if;
 if NEW.fee_basis_points>0 and nullif(btrim(NEW.fee_agreement_reference),'') is null then raise exception 'Agreed fee evidence required' using errcode='23514'; end if;
 converted := round(NEW.source_ad_spend_minor::numeric*quote.cad_cny_rate::numeric,0);
 fee := round(converted*NEW.fee_basis_points/10000,0);
 if NEW.ad_spend_minor<>converted or NEW.service_fee_minor<>fee then raise exception 'CNY amount or agreed fee mismatch' using errcode='23514'; end if;
 if exists(select 1 from public.monthly_ad_report_lines where report_id=NEW.id and (spend_minor<floor(source_cad_minor::numeric*quote.cad_cny_rate::numeric) or spend_minor>ceil(source_cad_minor::numeric*quote.cad_cny_rate::numeric))) then raise exception 'Converted line allocation mismatch' using errcode='23514'; end if;
 return NEW;
end;
$$;
revoke all on function public.validate_cny_statement() from public,anon,authenticated;
create trigger validate_cny_fx before insert or update on public.monthly_ad_reports for each row execute function public.validate_cny_statement();
commit;
