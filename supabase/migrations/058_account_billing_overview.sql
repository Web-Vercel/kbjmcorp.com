-- Read-only cross-month account status. No activation, preparation, publication or money writes.
begin;
create function public.get_account_billing_overview(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b record;first_date date;enabled boolean;tz text;current_month date;last_month date;next_month date;draft_month date;target date;gap boolean;flow jsonb;j jsonb;result jsonb:='[]'::jsonb;
begin
 if not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 for b in select x.*,coalesce(a.label,x.account_id) label from public.ads_reporting_bindings x join public.ad_accounts a on a.id=x.ad_account_id where x.organization_id=p_org order by x.account_id loop
  first_date:=null;enabled:=false;tz:=null;current_month:=null;last_month:=null;next_month:=null;draft_month:=null;target:=null;gap:=false;flow:=null;j:=null;
  select c.first_month,c.enabled into first_date,enabled from public.monthly_automation_settings c where c.binding_id=b.id;
  select timezone into tz from public.ads_reporting_snapshots where account_id=b.account_id order by created_at desc,id desc limit 1;
  if tz is not null then current_month:=date_trunc('month',now() at time zone tz)::date;end if;
  select max(month) into last_month from public.monthly_client_statements where binding_id=b.id;
  -- The earliest missing month is either the first month or the successor of a published month.
  -- This avoids both skipping gaps and expanding decades of monthly dates.
  if first_date is not null and current_month is not null then
   select min(c.period) into next_month from (
    select first_date as period union select (s.month+interval '1 month')::date from public.monthly_client_statements s where s.binding_id=b.id and s.month>=first_date
   ) c where c.period>=first_date and c.period<current_month and not exists(select 1 from public.monthly_client_statements s where s.binding_id=b.id and s.month=c.period);
   gap:=coalesce(next_month is not null and last_month>next_month,false);
  end if;
  select min(d.month) into draft_month from public.monthly_settlement_drafts d where d.binding_id=b.id and not exists(select 1 from public.monthly_client_statements s where s.binding_id=b.id and s.month=d.month);
  target:=coalesce(next_month,draft_month,case when first_date is not null and current_month is not null then greatest(first_date,current_month) end);
  if target is not null then
   select value into flow from jsonb_array_elements(public.get_month_close_overview(p_org,target)->'accounts') where value->>'binding_id'=b.id::text;
  end if;
  select jsonb_build_object('month',q.month,'state',q.state) into j from public.monthly_automation_jobs q where q.binding_id=b.id order by q.month desc limit 1;
  result:=result||jsonb_build_array(jsonb_build_object('binding_id',b.id,'account_id',b.account_id,'account_label',b.label,'active',b.active,'first_month',first_date,'automatic',coalesce(enabled,false),'timezone',tz,'current_month',current_month,'last_published_month',last_month,'next_month',next_month,'gap',gap,'task_month',target,'flow',flow,'job',j));
 end loop;
 return jsonb_build_object('organization_id',p_org,'accounts',result);
end $$;
revoke all on function public.get_account_billing_overview(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_account_billing_overview(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
