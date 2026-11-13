-- Hide and terminate only unsigned fictional access-test documents. Preserve immutable terms and audit history.
begin;
select pg_advisory_xact_lock(187654321,570003);
do $$ begin
 if exists(select 1 from public.client_contracts where id in
 ('e5800000-0000-4000-8000-000000000601','e5800000-0000-4000-8000-000000000602')
 and (template_version<>'preview-isolation-v1' or status not in ('sent','terminated') or signed_on is not null
 or signature_reference is not null or title not like '【虚构验收合同】测试企业%')) then
 raise exception 'Fixture changed; manual review required, nothing removed'; end if;
end $$;
insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes)
 select null,'preview_contract_fixture',id,'UPDATE',jsonb_build_object('source','owner_sql_editor','fictional',true)
 from public.client_contracts where id in
 ('e5800000-0000-4000-8000-000000000601','e5800000-0000-4000-8000-000000000602');
update public.client_contracts set status='terminated',client_visible=false,updated_at=now() where id in
 ('e5800000-0000-4000-8000-000000000601','e5800000-0000-4000-8000-000000000602');
commit;
