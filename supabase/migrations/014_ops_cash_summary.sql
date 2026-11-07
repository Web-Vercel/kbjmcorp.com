-- Read-only, single-statement cash snapshot. Does not approve or post money.
begin;
create function public.get_ops_cash_summary(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',w.id,'currency',w.currency,
  'balance_minor',coalesce((select sum(e.amount_minor) from public.wallet_entries e where e.wallet_id=w.id),0)::text,
  'pending_notice_count',(select count(*) from public.client_topups t where t.wallet_id=w.id and t.status='pending')::text,
  'pending_notice_minor',coalesce((select sum(t.amount_minor) from public.client_topups t where t.wallet_id=w.id and t.status='pending'),0)::text,
  'pending_receipt_count',(select count(*) from public.bank_receipts r where r.wallet_id=w.id and r.status='pending')::text,
  'pending_receipt_minor',coalesce((select sum(r.amount_minor) from public.bank_receipts r where r.wallet_id=w.id and r.status='pending'),0)::text,
  'recent_entries',coalesce((select jsonb_agg(x.record order by x.posted_at desc,x.id desc) from (
   select e.posted_at,e.id,jsonb_build_object('id',e.id,'kind',e.kind,'amount_minor',e.amount_minor::text,'description',e.description,'posted_at',e.posted_at) as record
   from public.wallet_entries e where e.wallet_id=w.id order by e.posted_at desc,e.id desc limit 10
  ) x),'[]'::jsonb)
 )) from public.client_wallets w where w.organization_id=p_org),'[]'::jsonb);
end $$;
revoke all on function public.get_ops_cash_summary(uuid) from public,anon;
grant execute on function public.get_ops_cash_summary(uuid) to authenticated;
commit;
