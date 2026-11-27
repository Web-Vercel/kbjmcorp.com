-- Owner-authorized Preview scenario: Kenny manual; Brianna remains automatic.
-- Run once in the Preview SQL Editor. Preserves first_month, agreement, sources and all prepared drafts.
begin;
do $$
declare bid uuid;v integer;
begin
 if not exists(select 1 from vault.decrypted_secrets where name='kbjm_preview_monthly_worker_url' and decrypted_secret='https://new-kbjmcorp-git-preview-tenant-isolation-kenny-ai-team.vercel.app/api/internal/monthly-automation') then
  raise exception 'Preview worker URL guard failed; no account changed';
 end if;
 select id into strict bid from public.ads_reporting_bindings where account_id='adacct_6ae4e89a73fc819f9ea4f671c68c849a' for update;
 update public.monthly_automation_settings set enabled=false,revision=revision+1,updated_at=now() where binding_id=bid and enabled returning revision into v;
 if found then
  update public.monthly_automation_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where binding_id=bid and state in ('pending','running','retry','failed');
  insert into public.audit_events(actor_id,entity_type,entity_id,operation,changes) values(null,'monthly_automation_setting',bid,'UPDATE',jsonb_build_object('enabled',false,'revision',v,'execution','owner_sql_editor','reason','Owner selected Kenny for manual Preview acceptance','no_publication',true));
 end if;
end $$;
select b.account_id,c.enabled,c.first_month from public.ads_reporting_bindings b left join public.monthly_automation_settings c on c.binding_id=b.id
where b.account_id in ('adacct_6ae4e89a73fc819f9ea4f671c68c849a','adacct_6b07cca2f6988197b787d60f3cd6b35e');
commit;
