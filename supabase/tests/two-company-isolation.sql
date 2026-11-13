-- TWO FICTIONAL COMPANIES: database-role isolation acceptance, ROLLBACK ONLY.
-- Run the ENTIRE file in the selected isolated Supabase test project's SQL Editor.
-- This creates temporary fixture Auth rows with no phone/password, not usable website logins.
-- Claims are simulated under the real authenticated DB role; this is NOT an actual Auth/HTTP/browser test.
-- All fixture rows, fake report metadata, fake ledger credits and audit entries are rolled back.
-- No bank, advertising, SMS or file service is contacted. No existing user is reassigned.
-- If ANY assertion errors, do not run fragments or replace rollback with commit.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
select pg_advisory_xact_lock(187654321,570002);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);

do $guard$ begin
 if to_regclass('public.customer_applications') is null or to_regclass('public.bank_receipts') is null then raise exception 'Migrations 001-013 required'; end if;
 if exists(select 1 from auth.users where id::text like 'e5700000-%') or exists(select 1 from public.organizations where id::text like 'e5700000-%') then raise exception 'Reserved fixture identifiers already exist; stop without overwriting'; end if;
end; $guard$;
insert into auth.users(id) values('e5700000-0000-4000-8000-000000000001'),('e5700000-0000-4000-8000-000000000002'),('e5700000-0000-4000-8000-000000000003'),('e5700000-0000-4000-8000-000000000004'),('e5700000-0000-4000-8000-000000000005');
insert into public.staff_members(user_id,role) values('e5700000-0000-4000-8000-000000000003','admin');
insert into public.organizations(id,name) values('e5700000-0000-4000-8000-000000000101','测试企业A · 星禾家居（虚构）'),('e5700000-0000-4000-8000-000000000102','测试企业B · 远舟科技（虚构）');
insert into public.client_profiles(organization_id,legal_name,country,status,internal_notes) values('e5700000-0000-4000-8000-000000000101','ISOLATION ONLY COMPANY A','CN','onboarding','PRIVATE-A'),('e5700000-0000-4000-8000-000000000102','ISOLATION ONLY COMPANY B','CN','onboarding','PRIVATE-B');
insert into public.memberships(organization_id,user_id,role) values('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000001','admin'),('e5700000-0000-4000-8000-000000000102','e5700000-0000-4000-8000-000000000002','admin'),('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000004','viewer');
insert into public.finance_access(organization_id,user_id,role) values('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000001','manager'),('e5700000-0000-4000-8000-000000000102','e5700000-0000-4000-8000-000000000002','manager'),('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000004','viewer');
insert into public.crm_contacts(organization_id,name,email) values('e5700000-0000-4000-8000-000000000101','虚构联系人A','a@example.invalid'),('e5700000-0000-4000-8000-000000000102','虚构联系人B','b@example.invalid');
insert into public.ad_accounts(id,organization_id,platform,external_id,label) values('e5700000-0000-4000-8000-000000000301','e5700000-0000-4000-8000-000000000101','openai_ads','ISOLATION-NOT-CONNECTED-A','虚构广告账户A'),('e5700000-0000-4000-8000-000000000302','e5700000-0000-4000-8000-000000000102','openai_ads','ISOLATION-NOT-CONNECTED-B','虚构广告账户B');
insert into public.projects(id,organization_id,ad_account_id,name,created_by) values('e5700000-0000-4000-8000-000000000401','e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000301','虚构项目A','e5700000-0000-4000-8000-000000000003'),('e5700000-0000-4000-8000-000000000402','e5700000-0000-4000-8000-000000000102','e5700000-0000-4000-8000-000000000302','虚构项目B','e5700000-0000-4000-8000-000000000003');
insert into public.client_wallets(id,organization_id,currency) values('e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000101','CNY'),('e5700000-0000-4000-8000-000000000202','e5700000-0000-4000-8000-000000000102','CNY');
insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values('e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000101','CNY','topup',1000000,'虚构测试金额，最终回滚','ISOLATION-FAKE-A'),('e5700000-0000-4000-8000-000000000202','e5700000-0000-4000-8000-000000000102','CNY','topup',2000000,'虚构测试金额，最终回滚','ISOLATION-FAKE-B');
insert into public.billing_fx_quotes(id,cad_cny_rate,value_date,quoted_at,source_name) values('e5700000-0000-4000-8000-000000000801','5',(now() at time zone 'Asia/Shanghai')::date,now(),'FICTIONAL SQL FIXTURE ONLY; NO LIVE RATE');

-- Fake report only for RLS checks; no real file exists and no cost is posted.
insert into public.monthly_ad_reports(id,wallet_id,organization_id,currency,ad_account_id,source_account_name,month,ad_spend_minor,source_language,translation_status,source_filename,source_timezone,source_storage_key,source_sha256,summary_zh,reviewed_by,source_currency,source_ad_spend_minor,fx_quote_id,settlement_date) values('e5700000-0000-4000-8000-000000000501','e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000101','CNY','e5700000-0000-4000-8000-000000000301','FICTIONAL ACCOUNT A',date_trunc('month',now())::date,50000,'zh','not_needed','ISOLATION-ONLY-NOT-A-REAL-REPORT.txt','UTC','isolation-test/not-a-real-file',repeat('0',64),'虚构报告，仅验证权限，事务最终回滚','e5700000-0000-4000-8000-000000000003','CAD',10000,'e5700000-0000-4000-8000-000000000801',(now() at time zone 'Asia/Shanghai')::date);
insert into public.monthly_ad_report_lines(report_id,campaign,market,spend_minor,source_cad_minor) values('e5700000-0000-4000-8000-000000000501','FICTIONAL CAMPAIGN A','FICTIONAL MARKET',50000,10000);
update public.monthly_ad_reports set published_at=now() where id='e5700000-0000-4000-8000-000000000501';
insert into public.client_contracts(id,organization_id,template_body,title,client_legal_name,provider_legal_name,service_scope,pricing_terms,refund_terms,starts_on,ends_on,status,client_visible,created_by) values('e5700000-0000-4000-8000-000000000601','e5700000-0000-4000-8000-000000000101','FICTIONAL DOCUMENT ONLY. NO LEGAL CONTRACT.','虚构合同A','FICTIONAL CLIENT A','FICTIONAL PROVIDER','FICTIONAL SCOPE ONLY','FICTIONAL PRICE ONLY','FICTIONAL REFUND ONLY',current_date,current_date+30,'sent',true,'e5700000-0000-4000-8000-000000000003');
insert into public.service_requests(id,organization_id,category,subject,created_by) values('e5700000-0000-4000-8000-000000000701','e5700000-0000-4000-8000-000000000101','billing','虚构财务工单A','e5700000-0000-4000-8000-000000000001');
insert into public.service_request_messages(request_id,body,author_id,author_role) values('e5700000-0000-4000-8000-000000000701','虚构工单内容A，不发送真实消息','e5700000-0000-4000-8000-000000000001','client');

-- Fake report only for RLS checks; no real file exists and no cost is posted.
insert into public.monthly_ad_reports(id,wallet_id,organization_id,currency,ad_account_id,source_account_name,month,ad_spend_minor,source_language,translation_status,source_filename,source_timezone,source_storage_key,source_sha256,summary_zh,reviewed_by,source_currency,source_ad_spend_minor,fx_quote_id,settlement_date) values('e5700000-0000-4000-8000-000000000502','e5700000-0000-4000-8000-000000000202','e5700000-0000-4000-8000-000000000102','CNY','e5700000-0000-4000-8000-000000000302','FICTIONAL ACCOUNT B',date_trunc('month',now())::date,50000,'zh','not_needed','ISOLATION-ONLY-NOT-A-REAL-REPORT.txt','UTC','isolation-test/not-a-real-file',repeat('0',64),'虚构报告，仅验证权限，事务最终回滚','e5700000-0000-4000-8000-000000000003','CAD',10000,'e5700000-0000-4000-8000-000000000801',(now() at time zone 'Asia/Shanghai')::date);
insert into public.monthly_ad_report_lines(report_id,campaign,market,spend_minor,source_cad_minor) values('e5700000-0000-4000-8000-000000000502','FICTIONAL CAMPAIGN B','FICTIONAL MARKET',50000,10000);
update public.monthly_ad_reports set published_at=now() where id='e5700000-0000-4000-8000-000000000502';
insert into public.client_contracts(id,organization_id,template_body,title,client_legal_name,provider_legal_name,service_scope,pricing_terms,refund_terms,starts_on,ends_on,status,client_visible,created_by) values('e5700000-0000-4000-8000-000000000602','e5700000-0000-4000-8000-000000000102','FICTIONAL DOCUMENT ONLY. NO LEGAL CONTRACT.','虚构合同B','FICTIONAL CLIENT B','FICTIONAL PROVIDER','FICTIONAL SCOPE ONLY','FICTIONAL PRICE ONLY','FICTIONAL REFUND ONLY',current_date,current_date+30,'sent',true,'e5700000-0000-4000-8000-000000000003');
insert into public.service_requests(id,organization_id,category,subject,created_by) values('e5700000-0000-4000-8000-000000000702','e5700000-0000-4000-8000-000000000102','billing','虚构财务工单B','e5700000-0000-4000-8000-000000000002');
insert into public.service_request_messages(request_id,body,author_id,author_role) values('e5700000-0000-4000-8000-000000000702','虚构工单内容B，不发送真实消息','e5700000-0000-4000-8000-000000000002','client');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000001","aal":"aal1"}',true);

do $assert$ begin
 if not ((select count(*) from public.organizations where id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: company list leaks or hides own company'; end if;
 if not (exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000101') and not exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000102')) then raise exception 'FAIL: guessed other company readable'; end if;
 if not ((select count(*) from public.get_my_company_profiles() where id='e5700000-0000-4000-8000-000000000101')=1) then raise exception 'FAIL: company profile RPC own association'; end if;
 if not ((select count(*) from public.get_client_wallets() where organization_id='e5700000-0000-4000-8000-000000000101' and balance_minor='1000000')=1) then raise exception 'FAIL: own exact CNY balance'; end if;
 if not (not exists(select 1 from public.get_client_wallets() where organization_id='e5700000-0000-4000-8000-000000000102')) then raise exception 'FAIL: finance RPC leaks another company'; end if;
 if not ((select count(*) from public.projects where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: project isolation'; end if;
 if not ((select count(*) from public.ad_accounts where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: ad account isolation'; end if;
 if not (exists(select 1 from public.monthly_ad_reports where id='e5700000-0000-4000-8000-000000000501') and not exists(select 1 from public.monthly_ad_reports where id='e5700000-0000-4000-8000-000000000502')) then raise exception 'FAIL: direct report ID isolation'; end if;
 if not ((select count(*) from public.monthly_ad_report_lines where report_id in ('e5700000-0000-4000-8000-000000000501','e5700000-0000-4000-8000-000000000502'))=1) then raise exception 'FAIL: report line isolation'; end if;
 if not (exists(select 1 from public.client_contracts where id='e5700000-0000-4000-8000-000000000601') and not exists(select 1 from public.client_contracts where id='e5700000-0000-4000-8000-000000000602')) then raise exception 'FAIL: direct contract ID isolation'; end if;
 if not ((select count(*) from public.wallet_entries where wallet_id in ('e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000202'))=1) then raise exception 'FAIL: ledger isolation'; end if;
 if not (exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000701') and not exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000702')) then raise exception 'FAIL: service request isolation'; end if;
 if not ((select count(*) from public.service_request_messages where request_id in ('e5700000-0000-4000-8000-000000000701','e5700000-0000-4000-8000-000000000702'))=1) then raise exception 'FAIL: service message isolation'; end if;
 if not (not exists(select 1 from public.client_profiles where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102')) and not exists(select 1 from public.crm_contacts where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))) then raise exception 'FAIL: internal CRM visible to client'; end if;
end; $assert$;

do $denied$ begin
 begin perform public.request_client_topup('e5700000-0000-4000-8000-000000000202',100,'ISOLATION-CROSS-COMPANY');raise exception 'FAIL: cross-company topup accepted';exception when insufficient_privilege then null;end;
 begin perform public.create_service_request('e5700000-0000-4000-8000-000000000102','billing','Cross company request','This fixture must be rejected');raise exception 'FAIL: cross-company service request accepted';exception when insufficient_privilege then null;end;
 begin update public.memberships set role='owner' where organization_id='e5700000-0000-4000-8000-000000000101';raise exception 'FAIL: client can elevate company role';exception when insufficient_privilege then null;end;
end; $denied$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000002","aal":"aal1"}',true);

do $assert$ begin
 if not ((select count(*) from public.organizations where id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: company list leaks or hides own company'; end if;
 if not (exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000102') and not exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000101')) then raise exception 'FAIL: guessed other company readable'; end if;
 if not ((select count(*) from public.get_my_company_profiles() where id='e5700000-0000-4000-8000-000000000102')=1) then raise exception 'FAIL: company profile RPC own association'; end if;
 if not ((select count(*) from public.get_client_wallets() where organization_id='e5700000-0000-4000-8000-000000000102' and balance_minor='2000000')=1) then raise exception 'FAIL: own exact CNY balance'; end if;
 if not (not exists(select 1 from public.get_client_wallets() where organization_id='e5700000-0000-4000-8000-000000000101')) then raise exception 'FAIL: finance RPC leaks another company'; end if;
 if not ((select count(*) from public.projects where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: project isolation'; end if;
 if not ((select count(*) from public.ad_accounts where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=1) then raise exception 'FAIL: ad account isolation'; end if;
 if not (exists(select 1 from public.monthly_ad_reports where id='e5700000-0000-4000-8000-000000000502') and not exists(select 1 from public.monthly_ad_reports where id='e5700000-0000-4000-8000-000000000501')) then raise exception 'FAIL: direct report ID isolation'; end if;
 if not ((select count(*) from public.monthly_ad_report_lines where report_id in ('e5700000-0000-4000-8000-000000000501','e5700000-0000-4000-8000-000000000502'))=1) then raise exception 'FAIL: report line isolation'; end if;
 if not (exists(select 1 from public.client_contracts where id='e5700000-0000-4000-8000-000000000602') and not exists(select 1 from public.client_contracts where id='e5700000-0000-4000-8000-000000000601')) then raise exception 'FAIL: direct contract ID isolation'; end if;
 if not ((select count(*) from public.wallet_entries where wallet_id in ('e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000202'))=1) then raise exception 'FAIL: ledger isolation'; end if;
 if not (exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000702') and not exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000701')) then raise exception 'FAIL: service request isolation'; end if;
 if not ((select count(*) from public.service_request_messages where request_id in ('e5700000-0000-4000-8000-000000000701','e5700000-0000-4000-8000-000000000702'))=1) then raise exception 'FAIL: service message isolation'; end if;
 if not (not exists(select 1 from public.client_profiles where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102')) and not exists(select 1 from public.crm_contacts where organization_id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))) then raise exception 'FAIL: internal CRM visible to client'; end if;
end; $assert$;

do $denied$ begin
 begin perform public.request_client_topup('e5700000-0000-4000-8000-000000000201',100,'ISOLATION-CROSS-COMPANY');raise exception 'FAIL: cross-company topup accepted';exception when insufficient_privilege then null;end;
 begin perform public.create_service_request('e5700000-0000-4000-8000-000000000101','billing','Cross company request','This fixture must be rejected');raise exception 'FAIL: cross-company service request accepted';exception when insufficient_privilege then null;end;
 begin update public.memberships set role='owner' where organization_id='e5700000-0000-4000-8000-000000000102';raise exception 'FAIL: client can elevate company role';exception when insufficient_privilege then null;end;
end; $denied$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000004","aal":"aal1"}',true);

do $assert$ begin
 if not (exists(select 1 from public.client_wallets where id='e5700000-0000-4000-8000-000000000201')) then raise exception 'FAIL: finance viewer cannot read own balance'; end if;
end; $assert$;

do $denied$ begin
 begin perform public.request_client_topup('e5700000-0000-4000-8000-000000000201',100,'ISOLATION-VIEWER-WRITE');raise exception 'FAIL: finance viewer can request topup';exception when insufficient_privilege then null;end;
end; $denied$;

reset role;
delete from public.finance_access where user_id='e5700000-0000-4000-8000-000000000004';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000004","aal":"aal1"}',true);

do $assert$ begin
 if not (exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000101')) then raise exception 'FAIL: business membership unexpectedly revoked'; end if;
 if not (not exists(select 1 from public.client_wallets where id='e5700000-0000-4000-8000-000000000201') and not exists(select 1 from public.monthly_ad_reports where id='e5700000-0000-4000-8000-000000000501') and not exists(select 1 from public.client_contracts where id='e5700000-0000-4000-8000-000000000601') and not exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000701')) then raise exception 'FAIL: removed finance permission remains effective'; end if;
end; $assert$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000005',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000005","aal":"aal1"}',true);

do $assert$ begin
 if not (not exists(select 1 from public.organizations where id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102')) and not exists(select 1 from public.client_wallets where id in ('e5700000-0000-4000-8000-000000000201','e5700000-0000-4000-8000-000000000202'))) then raise exception 'FAIL: unassociated user can access fixture companies'; end if;
end; $assert$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000003","aal":"aal1"}',true);

do $assert$ begin
 if not (not exists(select 1 from public.organizations where id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))) then raise exception 'FAIL: employee AAL1 can read protected CRM'; end if;
end; $assert$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000003","aal":"aal2"}',true);

do $assert$ begin
 if not ((select count(*) from public.organizations where id in ('e5700000-0000-4000-8000-000000000101','e5700000-0000-4000-8000-000000000102'))=2) then raise exception 'FAIL: authorized admin AAL2 cannot review both fixture companies'; end if;
end; $assert$;

reset role;
delete from public.memberships where organization_id='e5700000-0000-4000-8000-000000000101' and user_id='e5700000-0000-4000-8000-000000000001';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5700000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"e5700000-0000-4000-8000-000000000001","aal":"aal1"}',true);

do $assert$ begin
 if not (not exists(select 1 from public.organizations where id='e5700000-0000-4000-8000-000000000101') and not exists(select 1 from public.client_wallets where id='e5700000-0000-4000-8000-000000000201') and not exists(select 1 from public.service_requests where id='e5700000-0000-4000-8000-000000000701')) then raise exception 'FAIL: revoked company membership remains effective'; end if;
end; $assert$;

reset role;
-- Returned only after every assertion passes. The following rollback is mandatory.
select 'PASS' as isolation_result,
       'A/B reads, guessed IDs, cross-company writes, finance roles, revocation, MFA boundary' as checked,
       'SQL role simulation only; not actual customer login or browser validation' as scope;
rollback;
-- Confirm the fixture namespace was cleaned up; expected fixture_users=0 and fixture_companies=0.
select (select count(*) from auth.users where id::text like 'e5700000-%') as fixture_users,
       (select count(*) from public.organizations where id::text like 'e5700000-%') as fixture_companies;
