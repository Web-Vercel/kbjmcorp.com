-- READ ONLY. Run against the intended production database via an authorized SQL session.
-- No customer rows, credentials, MFA secrets or signed object URLs are returned.
begin read only;
select 'database_identity' as check_name,current_database() as database_name,current_user as executed_by,version() as database_version,now() as observed_at;
select 'required_functions' as check_name,f.name,to_regprocedure(f.signature) is not null as present
from (values
 ('client_scope','public.get_client_project_scope()'),
 ('company_profiles','public.get_my_company_profiles()'),
 ('manual_publication','public.publish_manual_statement(uuid,text)'),
 ('refund_workflow','public.partner_finance_action(text,uuid,jsonb)'),
 ('credential_session_gate','public.account_credential_session_valid()'),
 ('upstream_reversal','public.review_upstream_reversal(uuid,text,text)')
) f(name,signature);
select 'function_fingerprints' as check_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,md5(pg_get_functiondef(p.oid)) as definition_md5,p.proconfig as function_settings from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_my_company_profiles','get_client_project_scope','can_collaborate','partner_finance_action','has_finance_access','publish_manual_statement') order by p.proname;
select 'required_tables' as check_name,t.name,to_regclass('public.'||t.name) is not null as present from (values ('client_wallets'),('wallet_entries'),('monthly_client_statements'),('balance_refunds'),('partner_payments'),('account_credential_state')) t(name);
select 'financial_rls' as check_name,c.relname,c.relrowsecurity as rls_enabled,
 has_table_privilege('anon',c.oid,'SELECT') as anonymous_table_select,
 has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_direct_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_direct_update,
 has_table_privilege('authenticated',c.oid,'DELETE') as authenticated_direct_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('client_wallets','wallet_entries','monthly_client_statements','balance_refunds','partner_payments') order by c.relname;
select 'immutable_financial_triggers' as check_name,c.relname,t.tgname,t.tgenabled
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and c.relname in ('wallet_entries','monthly_client_statements','partner_payments') order by c.relname,t.tgname;
select 'storage_privacy' as check_name,b.id as bucket_id,b.public as publicly_readable,b.file_size_limit
from storage.buckets b order by b.id;
select 'storage_rls' as check_name,c.relrowsecurity as object_rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects';
-- Aggregate only: official production must not contain copied acceptance records.
select 'acceptance_data_presence' as check_name,
 (select count(*) from public.organizations where name like '%虚构%' or name like 'TEST-%' or name like 'FICTIONAL%') as fictional_company_count,
 (select count(*) from public.monthly_client_statements where summary_zh like '%ACCEPTANCE-TEST-NOT-PAYABLE%') as test_statement_count;
rollback;
