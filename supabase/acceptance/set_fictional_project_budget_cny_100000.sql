-- Preview only: owner-authorized replacement of ONE fictional project's planned budget.
-- This is not an FX conversion and does not change wallets, statements or ad-platform budgets.
-- Not a schema migration. Do not add to the production/bootstrap migration sequence.
begin;
do $$
declare
 target public.projects%rowtype;
 project_id constant uuid := '5bba2b88-42d6-4b41-b5c4-2d53b0d9c74b';
 org_id constant uuid := '36d7cb6f-653e-4f0e-b2e0-64d545319606';
begin
 if not exists(select 1 from public.organizations where id=org_id and name='财务流程验收企业（虚构）') then
  raise exception 'Fictional acceptance organization mismatch; nothing changed';
 end if;
 select * into target from public.projects where id=project_id for update;
 if not found or target.organization_id is distinct from org_id
 or target.name not like 'TEST-ONLY%广告项目保存回读测试%' then
  raise exception 'Fictional project mismatch; nothing changed';
 end if;
 if target.currency='CNY' and target.budget_amount=100000.00 then
  return; -- Re-running returns the same desired state; no additional audit or money write.
 end if;
 if target.currency is distinct from 'CAD' or target.budget_amount is distinct from 10000.00::numeric then
  raise exception 'Project budget differs from the reviewed CAD10000 state; nothing changed';
 end if;
 update public.projects set currency='CNY',budget_amount=100000.00 where id=project_id;
 insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 values(auth.uid(),'project_planned_budget',project_id,'UPDATE',jsonb_build_object(
 'organization_id',org_id,'previous_currency',target.currency,'previous_budget_amount',target.budget_amount::text,
 'currency','CNY','budget_amount','100000.00','reason','Owner-authorized fictional acceptance planned-budget replacement; not FX conversion; no wallet or advertising write'));
end $$;
select id,organization_id,name,currency,budget_amount from public.projects
where id='5bba2b88-42d6-4b41-b5c4-2d53b0d9c74b';
commit;
