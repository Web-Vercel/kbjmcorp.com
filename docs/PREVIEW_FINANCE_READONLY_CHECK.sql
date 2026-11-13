-- Run only after confirming the selected Supabase project in Dashboard.
-- Read-only evidence of constraints and existing ledger counts. No secrets or personal data.
begin read only;
select c.conrelid::regclass as table_name, c.conname, pg_get_constraintdef(c.oid) as rule
from pg_constraint c
where c.conrelid in ('public.monthly_client_statements'::regclass,
 'public.bank_receipts'::regclass,'public.wallet_entries'::regclass,
 'public.upstream_payment_records'::regclass)
and c.contype in ('u','p') order by 1,2;
select 'monthly_client_statements' as records, count(*) from public.monthly_client_statements
union all select 'bank_receipts',count(*) from public.bank_receipts
union all select 'wallet_entries',count(*) from public.wallet_entries
union all select 'upstream_payment_records',count(*) from public.upstream_payment_records;
select count(*) as dedicated_acceptance_companies from public.organizations
where name='财务流程验收企业（虚构）';
commit;
-- Zero existing rows does not establish readiness, environment identity or permissions.
