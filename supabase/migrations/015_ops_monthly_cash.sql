-- Read-only monthly ledger reconciliation, Beijing calendar boundaries.
begin;
create function public.get_ops_monthly_cash(p_org uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare starts timestamptz; ends timestamptz;
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<date '2000-01-01' or p_month>date_trunc('month',now() at time zone 'Asia/Shanghai')::date then raise exception 'Valid current or past month required' using errcode='22023'; end if;
 starts:=p_month::timestamp at time zone 'Asia/Shanghai';
 ends:=(p_month+interval '1 month')::timestamp at time zone 'Asia/Shanghai';
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',w.id,'currency',w.currency,'month',p_month::text,'timezone','Asia/Shanghai',
  'opening_minor',s.opening::text,'topup_minor',s.topup::text,
  'ad_spend_minor',s.ad_spend::text,'service_fee_minor',s.service_fee::text,
  'refund_minor',s.refund::text,'adjustment_minor',s.adjustment::text,
  'closing_minor',s.closing::text,'entry_count',s.n::text,'as_of',statement_timestamp()
 )) from public.client_wallets w cross join lateral (
  select coalesce(sum(e.amount_minor) filter(where e.posted_at<starts),0) opening,
   coalesce(sum(e.amount_minor) filter(where e.posted_at>=starts and e.kind='topup'),0) topup,
   -coalesce(sum(e.amount_minor) filter(where e.posted_at>=starts and e.kind='ad_spend'),0) ad_spend,
   -coalesce(sum(e.amount_minor) filter(where e.posted_at>=starts and e.kind='service_fee'),0) service_fee,
   -coalesce(sum(e.amount_minor) filter(where e.posted_at>=starts and e.kind='refund'),0) refund,
   coalesce(sum(e.amount_minor) filter(where e.posted_at>=starts and e.kind='adjustment'),0) adjustment,
   coalesce(sum(e.amount_minor),0) closing,
   count(*) filter(where e.posted_at>=starts) n
  from public.wallet_entries e where e.wallet_id=w.id and e.posted_at<ends
 ) s where w.organization_id=p_org),'[]'::jsonb);
end $$;
revoke all on function public.get_ops_monthly_cash(uuid,date) from public,anon;
grant execute on function public.get_ops_monthly_cash(uuid,date) to authenticated;
commit;
