-- Read-only monthly billing-question queue. Existing reply/status workflow is unchanged.
begin;
create function public.get_statement_question_workbench(p_org uuid,p_month date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if p_org is null or not public.has_ops_capability('finance.read',p_org) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_month is null or not isfinite(p_month) or extract(day from p_month)<>1 or p_month<date '2000-01-01' then raise exception 'Month must start on day one' using errcode='22023';end if;
 if not exists(select 1 from public.organizations where id=p_org) then raise exception 'Unknown organization' using errcode='22023';end if;
 with scoped as (
 select r.id,r.organization_id,r.category,r.subject,r.status,r.created_at,r.updated_at,r.statement_id,r.statement_month
 from public.service_requests r join public.monthly_client_statements s on s.id=r.statement_id and s.organization_id=r.organization_id and s.month=r.statement_month
 where r.organization_id=p_org and r.statement_month=p_month and r.category='billing'
 ), limited as (select * from scoped order by (status='resolved'),updated_at desc,id desc limit 100)
 select jsonb_build_object('organization_id',p_org,'month',p_month,'total_count',count(*),'open_count',count(*) filter(where status='open'),'in_progress_count',count(*) filter(where status='in_progress'),'resolved_count',count(*) filter(where status='resolved'),'truncated',count(*)>100,
 'rows',coalesce((select jsonb_agg(to_jsonb(l) order by (l.status='resolved'),l.updated_at desc,l.id desc) from limited l),'[]'::jsonb)) into result from scoped;
 return result;
end $$;
revoke all on function public.get_statement_question_workbench(uuid,date) from public,anon;
grant execute on function public.get_statement_question_workbench(uuid,date) to authenticated;
notify pgrst,'reload schema';
commit;
