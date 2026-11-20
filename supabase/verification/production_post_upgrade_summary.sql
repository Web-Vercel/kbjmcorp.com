-- 08 supplement: one read-only SELECT, one result table. Safe to repeat.
-- Run only in the intended Production project rywmjguhvnppfxwhherl.
-- Metadata checks are not a replacement for authenticated role/workflow acceptance.
with
expected_tables(name) as (values
 ('client_wallets'),('wallet_entries'),('monthly_client_statements'),
 ('partner_agents'),('partner_assignments'),('partner_leads'),('refund_policies'),
 ('balance_refunds'),('partner_commissions'),('partner_settlements'),
 ('partner_settlement_items'),('partner_payments'),('partner_files'),
 ('partner_actions'),('account_credential_state'),('account_credential_operations'),
 ('partner_file_visibility')
),
tables as (
 select e.name,c.oid,c.relrowsecurity
 from expected_tables e
 left join pg_namespace n on n.nspname='public'
 left join pg_class c on c.relnamespace=n.oid and c.relname=e.name and c.relkind='r'
),
expected_triggers(table_name,trigger_name,function_name) as (values
 ('wallet_entries','immutable_money','lock_posted_money'),
 ('monthly_client_statements','immutable_monthly_statement','lock_posted_money'),
 ('balance_refunds','refund_snapshot_history','guard_partner_record_history'),
 ('partner_commissions','commission_snapshot_history','guard_partner_record_history'),
 ('partner_settlements','settlement_snapshot_history','guard_partner_record_history'),
 ('partner_assignments','assignment_snapshot_history','guard_partner_record_history'),
 ('refund_policies','refund_policy_history','guard_partner_record_history'),
 ('partner_files','immutable_partner_file','lock_posted_money'),
 ('partner_settlement_items','immutable_settlement_items','lock_posted_money'),
 ('partner_file_visibility','immutable_partner_file_visibility','lock_posted_money')
),
checks(check_group,item,passed,detail) as (
 select '01_tables_rls',name,coalesce(oid is not null and relrowsecurity,false),
  case when oid is null then 'table missing' else 'RLS='||relrowsecurity::text end
 from tables
 union all
 select '02_no_direct_financial_writes',name,
  case when oid is null then false else
   not has_any_column_privilege('authenticated',oid,'INSERT,UPDATE')
   and not has_table_privilege('authenticated',oid,'DELETE,TRUNCATE')
   and not has_any_column_privilege('anon',oid,'SELECT,INSERT,UPDATE')
   and not has_table_privilege('anon',oid,'DELETE,TRUNCATE') end,
  'Expected: no authenticated direct writes and no anonymous reads/writes'
 from tables where name in ('client_wallets','wallet_entries','monthly_client_statements',
  'balance_refunds','partner_payments','account_credential_state','account_credential_operations')
 union all
 select '03_history_triggers',e.table_name||'.'||e.trigger_name,
  exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
   join pg_namespace n on n.oid=p.pronamespace
   where t.tgrelid=to_regclass('public.'||e.table_name) and t.tgname=e.trigger_name
    and not t.tgisinternal and t.tgenabled in ('O','A') and (t.tgtype::int & 27)=27
    and n.nspname='public' and p.proname=e.function_name),
  'Expected enabled BEFORE ROW UPDATE/DELETE trigger -> public.'||e.function_name
 from expected_triggers e
 union all
 select '04_storage','partner-documents private bucket',
  exists(select 1 from storage.buckets where id='partner-documents' and public=false),
  'Expected partner-documents exists and public=false'
 union all
 select '04_storage','storage.objects RLS',
  exists(select 1 from pg_class where oid=to_regclass('storage.objects') and relrowsecurity),
  'Expected storage.objects RLS=true'
 union all
 select '04_storage',e.name,
  exists(select 1 from pg_policies p where p.schemaname='storage' and p.tablename='objects'
   and p.policyname=e.name and p.cmd=e.command and 'authenticated'=any(p.roles)
   and coalesce(p.qual,p.with_check,'') like '%partner-documents%'
   and coalesce(p.qual,p.with_check,'') like '%can_partner_file_path%'),
  'Expected role-scoped partner document policy; inspect all policies separately'
 from (values ('partner_document_read','SELECT'),('partner_document_insert','INSERT')) e(name,command)
 union all
 select '05_no_test_data','fictional_company_count',count(*)=0,'count='||count(*)::text
 from public.organizations where name like '%虚构%' or name like 'TEST-%' or name like 'FICTIONAL%'
 union all
 select '05_no_test_data','test_statement_count',count(*)=0,'count='||count(*)::text
 from public.monthly_client_statements where summary_zh like '%ACCEPTANCE-TEST-NOT-PAYABLE%'
)
select check_group,item,case when passed then 'PASS' else 'FAIL' end as status,detail
from checks
union all
select '06_storage_policy_inventory',policyname,'REVIEW',
 'roles='||roles::text||'; command='||cmd||'; using='||coalesce(qual,'-')||'; check='||coalesce(with_check,'-')
from pg_policies where schemaname='storage' and tablename='objects'
order by check_group,item;
