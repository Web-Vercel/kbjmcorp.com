-- Same read-only funds calculation for client and scoped staff; no new money writes.
begin;
create function public.build_monthly_funds_report(p_wallet uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w public.client_wallets%rowtype; a timestamptz; b timestamptz; result jsonb;
begin
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>=date_trunc('month',now() at time zone 'America/Vancouver')::date then
 raise exception 'Select an ended calendar month' using errcode='22023';end if;
 select * into w from public.client_wallets where id=p_wallet;
 if not found then raise exception 'Forbidden' using errcode='42501';end if;
 a:=p_month::timestamp at time zone 'America/Vancouver';
 b:=(p_month+interval '1 month')::timestamp at time zone 'America/Vancouver';
 select jsonb_build_object('wallet_id',w.id,'organization_name',(select name from public.organizations where id=w.organization_id),'currency',w.currency,'month',p_month,'timezone','America/Vancouver','generated_at',now(),
 'opening_minor',coalesce(sum(e.amount_minor) filter(where e.posted_at<a),0)::text,
 'credits_minor',coalesce(sum(e.amount_minor) filter(where e.posted_at>=a and e.amount_minor>0),0)::text,
 'debits_minor',(-coalesce(sum(e.amount_minor) filter(where e.posted_at>=a and e.amount_minor<0),0))::text,
 'closing_minor',coalesce(sum(e.amount_minor),0)::text,
 'entry_count',count(*) filter(where e.posted_at>=a),
 'complete',count(*) filter(where e.posted_at>=a)<=1000,
 'entries',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'amount_minor',x.amount_minor::text,'description',x.description,'posted_at',x.posted_at,
 'statement_id',(select s.id from public.monthly_client_statements s where s.wallet_id=w.id and x.source_reference='monthly-statement:'||s.id::text and x.kind in ('ad_spend','service_fee') and x.amount_minor<0),'statement_month',(select s.month from public.monthly_client_statements s where s.wallet_id=w.id and x.source_reference='monthly-statement:'||s.id::text and x.kind in ('ad_spend','service_fee') and x.amount_minor<0)) order by x.posted_at,x.id)
 from (select * from public.wallet_entries where wallet_id=w.id and posted_at>=a and posted_at<b order by posted_at,id limit 1000)x),'[]'::jsonb)) into result
 from public.wallet_entries e where e.wallet_id=w.id and e.posted_at<b;
 return result;
end $$;
-- Only checked SECURITY DEFINER entry points may call the shared builder.
revoke all on function public.build_monthly_funds_report(uuid,date) from public,anon,authenticated,service_role;
create or replace function public.get_client_monthly_funds(p_wallet uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.client_wallets where id=p_wallet and public.has_finance_access(organization_id)) then raise exception 'Forbidden' using errcode='42501';end if;
 return public.build_monthly_funds_report(p_wallet,p_month);
end $$;
create function public.get_ops_monthly_funds(p_org uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare wallet uuid;
begin
 if p_org is null or not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>=date_trunc('month',now() at time zone 'America/Vancouver')::date then raise exception 'Select an ended calendar month' using errcode='22023';end if;
 if not exists(select 1 from public.organizations where id=p_org) then raise exception 'Unknown organization' using errcode='22023';end if;
 select id into wallet from public.client_wallets where organization_id=p_org and currency='CNY';
 if wallet is null then return null;end if;
 return public.build_monthly_funds_report(wallet,p_month);
end $$;
revoke all on function public.get_ops_monthly_funds(uuid,date) from public,anon;
grant execute on function public.get_ops_monthly_funds(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
