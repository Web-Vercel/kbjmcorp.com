-- Read-only statement navigation and complete latest-month totals per authorized wallet.
begin;
create function public.get_client_monthly_statements(p_wallet uuid,p_month date,p_statement uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_month is not null and (not isfinite(p_month) or extract(day from p_month)<>1) then raise exception 'Month must start on day one' using errcode='22023';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'wallet_id',s.wallet_id,'organization_id',s.organization_id,'organization_name',o.name,'month',s.month,'currency',s.currency,
 'advertising_service_minor',s.upstream_cny_minor::text,'operating_other_minor',s.service_cny_minor::text,'total_minor',s.total_cny_minor::text,'summary_zh',s.summary_zh,'usage',s.usage,'published_at',s.published_at) order by s.month desc,s.published_at desc,s.id desc)
 from (select * from public.monthly_client_statements where public.has_finance_access(organization_id) and (p_wallet is null or wallet_id=p_wallet) and (p_month is null or month=p_month) and (p_statement is null or id=p_statement) order by month desc,published_at desc,id desc limit 100)s join public.organizations o on o.id=s.organization_id),'[]'::jsonb);
end $$;
create or replace function public.get_client_monthly_statements() returns jsonb language sql stable security definer set search_path='' as $$
 select public.get_client_monthly_statements(null::uuid,null::date,null::uuid);
$$;
create function public.get_client_statement_summaries() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.row order by x.wallet_id),'[]'::jsonb) from (
 select w.id wallet_id,jsonb_build_object('wallet_id',w.id,'month',latest.month,'statement_count',count(*),'advertising_service_minor',sum(s.upstream_cny_minor)::text,'operating_other_minor',sum(s.service_cny_minor)::text,'total_minor',sum(s.total_cny_minor)::text) row
 from public.client_wallets w join lateral (select month from public.monthly_client_statements where wallet_id=w.id order by month desc limit 1)latest on true
 join public.monthly_client_statements s on s.wallet_id=w.id and s.month=latest.month
 where w.currency='CNY' and public.has_finance_access(w.organization_id) group by w.id,latest.month
 )x;
$$;
revoke all on function public.get_client_monthly_statements(uuid,date,uuid),public.get_client_statement_summaries() from public,anon;
grant execute on function public.get_client_monthly_statements(uuid,date,uuid),public.get_client_statement_summaries() to authenticated;
notify pgrst,'reload schema';
commit;
