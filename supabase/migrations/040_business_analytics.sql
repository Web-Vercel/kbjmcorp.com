-- Read-only analytics. Publication and financial workflows are unchanged.
begin;
create function public.get_business_analytics(p_from date,p_until date,p_org uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.live_access_accounts%rowtype;scope_id uuid;companies jsonb;daily jsonb;statements jsonb;cash jsonb;balances jsonb;pipeline jsonb;projects jsonb;service jsonb;followups jsonb;result jsonb;
begin
 a:=public.require_live_account(true);
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365 then raise exception 'Invalid analytics range' using errcode='22023';end if;
 if a.role<>'investor' and p_org is not null and p_org<>a.organization_id then raise exception 'Forbidden company' using errcode='42501';end if;
 scope_id:=case when a.role='investor' then p_org else a.organization_id end;
 if scope_id is not null and not exists(select 1 from public.organizations where id=scope_id) then raise exception 'Unknown company' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'createdAt',o.created_at) order by o.name,o.id),'[]') into companies from public.organizations o where a.role='investor' or o.id=scope_id;
 if a.role='investor' then
  with rows as (
   select distinct on(s.account_id,d->>'date') s.account_id,s.account_name,s.currency,s.timezone,b.organization_id,d,s.id,s.created_at,s.check_status,coalesce(s.report->>'coverageKind','pending') coverage
   from public.ads_reporting_snapshots s left join public.ads_reporting_bindings b on b.account_id=s.account_id
   cross join lateral jsonb_array_elements(s.report->'daily') d
   where (scope_id is null or b.organization_id=scope_id) and s.since<=p_until and s.until>=p_from
    and d->>'date' between p_from::text and p_until::text
    and d->>'impressions' ~ '^[0-9]{1,20}$' and d->>'clicks' ~ '^[0-9]{1,20}$' and d->>'spendMicros' ~ '^[0-9]{1,20}$'
   order by s.account_id,d->>'date',s.created_at desc,s.id desc
  ) select coalesce(jsonb_agg(jsonb_build_object('date',d->>'date','accountId',account_id,'accountName',account_name,'companyId',organization_id,'currency',currency,'timezone',timezone,'impressions',d->>'impressions','clicks',d->>'clicks','spendMicros',d->>'spendMicros','sourceId',id,'sourceAt',created_at,'status',case when check_status='matched' and coverage in ('complete_rows','aggregate_verified') then 'matched' else 'pending' end) order by account_id,d->>'date'),'[]') into daily from rows;
 elsif a.role='client' then
  -- Client performance uses published customer metrics only. Internal source spend/FX is never projected.
  with rows as (
   select distinct on(s.binding_id,d->>'date') b.account_id,s.usage->>'account_name' account_name,s.usage->>'timezone' timezone,d,s.id,s.published_at
   from public.monthly_client_statements s join public.ads_reporting_bindings b on b.id=s.binding_id and b.organization_id=s.organization_id
   cross join lateral jsonb_array_elements(s.usage->'daily') d
   where s.organization_id=scope_id and d->>'date' between p_from::text and p_until::text
    and d->>'impressions' ~ '^[0-9]{1,20}$' and d->>'clicks' ~ '^[0-9]{1,20}$'
   order by s.binding_id,d->>'date',s.published_at desc,s.id desc
  ) select coalesce(jsonb_agg(jsonb_build_object('date',d->>'date','accountId',account_id,'accountName',account_name,'companyId',scope_id,'currency',null,'timezone',timezone,'impressions',d->>'impressions','clicks',d->>'clicks','spendMicros',null,'sourceId',id,'sourceAt',published_at,'status','published') order by account_id,d->>'date'),'[]') into daily from rows;
 end if;
 if a.role in ('investor','client') then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'walletId',s.wallet_id,'companyId',s.organization_id,'month',s.month,'advertisingMinor',s.upstream_cny_minor::text,'otherMinor',s.service_cny_minor::text,'totalMinor',s.total_cny_minor::text,'publishedAt',s.published_at) order by s.month,s.id),'[]') into statements from public.monthly_client_statements s where (scope_id is null or s.organization_id=scope_id) and s.month<=p_until and (s.month+interval '1 month'-interval '1 day')::date>=p_from;
  select coalesce(jsonb_agg(jsonb_build_object('date',day_key,'currency',currency,'creditedMinor',credit::text) order by day_key,currency),'[]') into cash from (
   select (e.posted_at at time zone 'UTC')::date day_key,e.currency,sum(e.amount_minor) credit from public.wallet_entries e where (scope_id is null or e.organization_id=scope_id) and e.kind='topup' and (e.posted_at at time zone 'UTC')::date between p_from and p_until group by 1,2
  ) v;
  select coalesce(jsonb_agg(jsonb_build_object('companyId',organization_id,'currency',currency,'balanceMinor',balance::text) order by organization_id,currency),'[]') into balances from (
   select w.organization_id,w.currency,coalesce(sum(e.amount_minor),0) balance from public.client_wallets w left join public.wallet_entries e on e.wallet_id=w.id where scope_id is null or w.organization_id=scope_id group by w.organization_id,w.currency
  ) v;
 end if;
 if a.role in ('investor','sales') then
  select coalesce(jsonb_agg(jsonb_build_object('stage',stage,'count',n) order by stage),'[]') into pipeline from (
   select o.stage,count(*) n from public.crm_opportunities o join public.crm_contacts c on c.id=o.contact_id where (scope_id is null or c.organization_id=scope_id) and (o.created_at at time zone 'UTC')::date between p_from and p_until group by o.stage
  ) v;
  select coalesce(jsonb_agg(jsonb_build_object('stage',status,'count',n) order by status),'[]') into projects from (
   select status,count(*) n from public.projects where (scope_id is null or organization_id=scope_id) and (created_at at time zone 'UTC')::date between p_from and p_until group by status
  ) v;
  select coalesce(jsonb_agg(jsonb_build_object('stage',status,'count',n) order by status),'[]') into service from (
   select status,count(*) n from public.service_requests where (scope_id is null or organization_id=scope_id) and (a.role='investor' or category<>'billing') and (created_at at time zone 'UTC')::date between p_from and p_until group by status
  ) v;
  select coalesce(jsonb_agg(jsonb_build_object('date',day_key,'count',n) order by day_key),'[]') into followups from (
   select (created_at at time zone 'UTC')::date day_key,count(*) n from public.live_sales_updates where (scope_id is null or organization_id=scope_id) and (created_at at time zone 'UTC')::date between p_from and p_until group by 1
  ) v;
 end if;
 result:=jsonb_build_object('version','business-analytics-v1','role',a.role,'userId',a.user_id,'scopeId',scope_id,'from',p_from,'until',p_until,'asOf',clock_timestamp(),'companies',companies,'daily',coalesce(daily,'[]'),'statements',coalesce(statements,'[]'),'cash',coalesce(cash,'[]'),'balances',coalesce(balances,'[]'),'pipeline',coalesce(pipeline,'[]'),'projects',coalesce(projects,'[]'),'service',coalesce(service,'[]'),'followups',coalesce(followups,'[]'));
 if jsonb_array_length(result->'daily')>20000 or octet_length(result::text)>8388608 then raise exception 'Analytics range too large' using errcode='54000';end if;
 return result;
end $$;
revoke all on function public.get_business_analytics(date,date,uuid) from public,anon;
grant execute on function public.get_business_analytics(date,date,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
