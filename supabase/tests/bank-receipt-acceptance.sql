-- MANUAL isolated test project ONLY. Entire file rolls back; no real bank/SMS calls.
-- Auth claims are simulated under authenticated DB role, NOT a browser/MFA test.
-- No existing employee, customer, authorization or balance is changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(187654321,570004);
do $$ begin
 if exists(select 1 from auth.users where id::text like 'e5900000-%')
 or exists(select 1 from public.organizations where id::text like 'e5900000-%') then
 raise exception 'Reserved fixture identifiers exist; stop without overwriting'; end if;
end $$;
insert into auth.users(id) values('e5900000-0000-4000-8000-000000000001'),('e5900000-0000-4000-8000-000000000002'),('e5900000-0000-4000-8000-000000000003'),('e5900000-0000-4000-8000-000000000004');
insert into public.staff_members(user_id,role) values('e5900000-0000-4000-8000-000000000001','admin'),('e5900000-0000-4000-8000-000000000002','operator'),('e5900000-0000-4000-8000-000000000003','operator');
insert into public.staff_unit_roles(user_id,unit_code,role) values
 ('e5900000-0000-4000-8000-000000000002','zhidian_cn','finance_preparer'),('e5900000-0000-4000-8000-000000000002','zhidian_cn','finance_reviewer'),('e5900000-0000-4000-8000-000000000003','zhidian_cn','finance_reviewer');
insert into public.organizations(id,name) values('e5900000-0000-4000-8000-000000000101','ROLLBACK ONLY 虚构收款验收');
insert into public.memberships(organization_id,user_id,role) values('e5900000-0000-4000-8000-000000000101','e5900000-0000-4000-8000-000000000004','viewer');
insert into public.finance_access(organization_id,user_id,role) values('e5900000-0000-4000-8000-000000000101','e5900000-0000-4000-8000-000000000004','viewer');
insert into public.client_wallets(id,organization_id,currency) values('e5900000-0000-4000-8000-000000000201','e5900000-0000-4000-8000-000000000101','CNY');
set local role authenticated;
do $accept$
declare bank uuid; receipt uuid; balance text;
begin
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000001',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000001","aal":"aal2"}',true);
 bank:=public.create_collection_account('ROLLBACK FICTIONAL COMPANY','ROLLBACK FICTIONAL BANK','NO-PAYMENT-E590','FICTIONAL-EVIDENCE-ONLY');
 perform public.assign_collection_account('e5900000-0000-4000-8000-000000000201',bank,'FICTIONAL-AGREEMENT-ONLY');
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000002',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000002","aal":"aal2"}',true);
 receipt:=public.prepare_bank_receipt('e5900000-0000-4000-8000-000000000201',null,100001,'FICTIONAL PAYER','ROLLBACK-BANK-001',(now() at time zone 'Asia/Shanghai')::date,'FICTIONAL-STATEMENT');
 begin perform public.review_bank_receipt(receipt,'credited','Self review must fail');
 raise exception 'FAIL self-review accepted'; exception when insufficient_privilege then null; end;
 begin perform public.prepare_bank_receipt('e5900000-0000-4000-8000-000000000201',null,100001,'FICTIONAL PAYER',' rollback-bank-001 ',(now() at time zone 'Asia/Shanghai')::date,'FICTIONAL-STATEMENT');
 raise exception 'FAIL duplicate reference accepted'; exception when unique_violation then null; end;
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000004',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000004","aal":"aal1"}',true);
 select balance_minor into balance from public.get_client_wallets() where id='e5900000-0000-4000-8000-000000000201';
 if balance is distinct from '0' then raise exception 'FAIL preparation changed balance'; end if;
 begin perform public.review_bank_receipt(receipt,'credited','Client must not approve');
 raise exception 'FAIL client approval accepted'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000003',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000003","aal":"aal1"}',true);
 begin perform public.review_bank_receipt(receipt,'credited','Missing second factor');
 raise exception 'FAIL missing MFA accepted'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000003',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000003","aal":"aal2"}',true);
 perform public.review_bank_receipt(receipt,'credited','Independent fictional bank reconciliation');
 perform public.review_bank_receipt(receipt,'credited','Retry must not credit twice');
 begin perform public.review_bank_receipt(receipt,'rejected','Conflicting retry must fail');
 raise exception 'FAIL conflicting review accepted'; exception when serialization_failure then null; end;
 perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000004',true); perform set_config('request.jwt.claims','{"sub":"e5900000-0000-4000-8000-000000000004","aal":"aal1"}',true);
 select balance_minor into balance from public.get_client_wallets() where id='e5900000-0000-4000-8000-000000000201';
 if balance is distinct from '100001' then raise exception 'FAIL exact posted balance or retry'; end if;
 if (select count(*) from public.wallet_entries where wallet_id='e5900000-0000-4000-8000-000000000201')<>1 then raise exception 'FAIL duplicate posting'; end if;
 if exists(select 1 from public.bank_receipts where wallet_id='e5900000-0000-4000-8000-000000000201') then raise exception 'FAIL internal bank evidence exposed'; end if;
end $accept$;
reset role;
select 'PASS' as receipt_acceptance;
rollback;
select (select count(*) from auth.users where id::text like 'e5900000-%') as fixture_users,
 (select count(*) from public.organizations where id::text like 'e5900000-%') as fixture_companies;
