-- Read-only verification for the selected test project. No customer rows, keys or user identities are returned.
select 'customer_applications' as component, to_regclass('public.customer_applications') is not null as present
union all select 'bank_receipts',to_regclass('public.bank_receipts') is not null
union all select 'ops_reconciliations',to_regclass('public.ops_reconciliations') is not null
union all select 'client_wallets',to_regclass('public.client_wallets') is not null
union all select 'staff_members',to_regclass('public.staff_members') is not null;

select c.relname as business_table,c.relrowsecurity as row_level_security_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

select p.proname as business_function
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'get_my_customer_applications','save_customer_application','review_customer_application',
 'prepare_bank_receipt','review_bank_receipt','get_ops_context','assign_operating_role'
)
order by p.proname;
