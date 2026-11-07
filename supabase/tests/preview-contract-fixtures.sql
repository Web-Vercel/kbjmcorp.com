-- MANUAL ONLY: isolated test project; persists two clearly fictional contracts.
-- Requires exactly one active admin and the pre-existing 测试企业A / 测试企业B.
-- Never runs as a migration. Does not grant access, sign contracts or move money.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(187654321,570003);
do $$
declare actor uuid; org uuid; label text; fixture uuid;
begin
 if (select count(*) from public.staff_members where role='admin' and active)=1 then
  select user_id into actor from public.staff_members where role='admin' and active;
 else raise exception 'Exactly one active test administrator required; stop for manual review'; end if;
 foreach label in array array['测试企业A','测试企业B'] loop
  if (select count(*) from public.organizations where name=label)<>1 then
   raise exception 'Expected exactly one test company: %',label;
  end if;
  select id into org from public.organizations where name=label;
  if (select count(*) from public.finance_access f join public.memberships m using(organization_id,user_id)
      where f.organization_id=org and f.role='viewer' and m.role='viewer'
      and not exists(select 1 from public.staff_members s where s.user_id=f.user_id))<>1 then
   raise exception 'Expected one approved readonly test client: %',label;
  end if;
  fixture:=case when label='测试企业A' then 'e5800000-0000-4000-8000-000000000601'::uuid else 'e5800000-0000-4000-8000-000000000602'::uuid end;
  if exists(select 1 from public.client_contracts where id=fixture) then
   raise exception 'Fixture already exists; do not overwrite or run twice';
  end if;
  insert into public.client_contracts(id,organization_id,template_version,template_body,title,
   client_legal_name,provider_legal_name,service_scope,pricing_terms,refund_terms,
   starts_on,ends_on,status,client_visible,created_by)
  values(fixture,org,'preview-isolation-v1',
   '仅用于两个虚构企业的权限验收，不构成真实合同、签署承诺或付款依据。FICTIONAL ACCESS TEST ONLY.',
   '【虚构验收合同】'||label,label,'虚构测试服务方（非真实签约主体）',
   '仅验证本企业可查看、其他企业不可查看的合同详情访问权限。',
   '无真实费用，不开通广告，不充值，不产生任何账务流水。',
   '无实际付款或退款；完成验收后将归档并隐藏本测试合同。',
   current_date,current_date+30,'sent',true,actor);
  insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
  values(null,'preview_contract_fixture',fixture,'INSERT',
   jsonb_build_object('source','owner_sql_editor','organization_id',org,'fictional',true));
 end loop;
end $$;
select title,id as contract_id,'/zh/account/contracts/'||id::text as test_path
 from public.client_contracts where id in
 ('e5800000-0000-4000-8000-000000000601','e5800000-0000-4000-8000-000000000602')
 order by title;
commit;
