-- Read-only, agent-scoped refund progress. No money, roles or notifications seeded.
begin;
do $$begin if to_regprocedure('public.account_credential_session_valid()') is null then raise exception 'Apply migrations through 046 before 047';end if;end $$;
create function public.read_agent_refund_progress() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.partner_agents%rowtype; rows jsonb;
begin
 a:=public.require_partner_agent(true);
 -- Never infer ownership from the browser or expose future assignees to old refunds.
 select coalesce(jsonb_agg(t),'[]'::jsonb) into rows from (
  select r.id,r.organization_id,o.name company,r.gross_minor::text,r.status,r.created_at,r.paid_at,
   public.partner_org_refund_hold(r.organization_id) commission_paused
  from public.balance_refunds r join public.organizations o on o.id=r.organization_id
  where exists(select 1 from public.partner_assignments x where x.agent_id=a.id and x.organization_id=r.organization_id
    and x.created_at<=r.created_at and x.valid_from<=date_trunc('month',r.created_at at time zone 'Asia/Shanghai')::date
    and (x.valid_until is null or x.valid_until>date_trunc('month',r.created_at at time zone 'Asia/Shanghai')::date))
   or exists(select 1 from public.partner_commissions c where c.agent_id=a.id and c.organization_id=r.organization_id and c.created_at<=r.created_at)
  order by r.created_at desc,r.id limit 100
 )t;
 return jsonb_build_object('agentId',a.id,'refunds',rows);
end $$;
revoke all on function public.read_agent_refund_progress() from public,anon;
grant execute on function public.read_agent_refund_progress() to authenticated;
notify pgrst,'reload schema';
commit;
