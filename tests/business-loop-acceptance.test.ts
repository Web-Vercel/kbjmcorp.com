import {monthCloseOverview} from '@/lib/operations/month-close-overview';
import {buildCadAllocationReport,cadAllocationReportCsv} from '@/lib/operations/cad-allocation-report';
import {publicationPreview} from '@/lib/operations/publication-preview';
import {monthFunding} from '@/lib/operations/month-funding';
import {buildMonthCloseChecklist,monthCloseChecklistCsv} from '@/lib/operations/month-close-checklist';
import {statementQuestionWorkbench} from '@/lib/operations/statement-questions';
import {statementReadStatus} from '@/lib/billing/statement-read';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {applyMigrationsThrough} from './fixtures/migrations';
import {buildQuoteSnapshot} from '@/lib/billing/quote-snapshot';
import {clientStatementSchema} from '@/lib/billing/client-statement';
import {statementCsv,statementHtml} from '@/lib/billing/statement-export';
import {upstreamPaymentWorkbench} from '@/lib/billing/upstream-payments';
import {mainFlow} from '@/lib/operations/main-flow';
import type {CloseOverview} from '@/lib/operations/month-close';
let db:PGlite;let originalStatement:string;const org='b0000000-0000-4000-8000-000000000001';
beforeAll(async()=>{db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);await applyMigrationsThrough(db,37);
 await db.exec(`insert into auth.users(id) select ('a0000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,5)n;insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin'),('a0000000-0000-4000-8000-000000000002','operator'),('a0000000-0000-4000-8000-000000000003','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('a0000000-0000-4000-8000-000000000002','zhidian_cn','finance_preparer'),('a0000000-0000-4000-8000-000000000003','zhidian_cn','finance_reviewer');insert into public.organizations(id,name) values('${org}','FICTIONAL BUSINESS LOOP ACCEPTANCE');`);
},30000);
afterAll(async()=>{await db?.close();});
async function as(who:string,sql:string,args:unknown[]=[]){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${who}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r.rows[0];}catch(e){await db.exec('rollback');throw e;}}
const overview=async()=>{const raw=(await as('1',"select public.get_month_close_overview($1,'2024-01-01') data",[org])).data;const parsed=monthCloseOverview(raw,{organizationId:org,month:'2024-01-01'});expect(parsed).not.toBeNull();return parsed!;};
it('runs one fictional case through verified bank credit, source, quote, client charge/export and CAD allocation',async()=>{
 const wallet=(await as('1','select public.open_crm_wallet($1) id',[org])).id;
 const bank=(await as('1',"select public.create_collection_account('FICTIONAL RECEIVING COMPANY','FICTIONAL BANK','TEST-NOT-PAYABLE-LOOP','FICTIONAL-EVIDENCE') id")).id;
 await as('1',"select public.assign_collection_account($1,$2,'FICTIONAL AGREEMENT')",[wallet,bank]);
 const receipt=(await as('2',"select public.prepare_bank_receipt($1,null,100000,'FICTIONAL PAYER','FICTIONAL-CNY-RECEIPT','2024-01-31','FICTIONAL BANK ORIGINAL') id",[wallet])).id;
 expect((await overview()).balance_minor).toBe('0');await expect(as('2',"select public.review_bank_receipt($1,'credited','Self review')",[receipt])).rejects.toThrow(/Independent|Forbidden/);
 await as('3',"select public.review_bank_receipt($1,'credited','Independent bank receipt verification')",[receipt]);await as('3',"select public.review_bank_receipt($1,'credited','Retry bank approval')",[receipt]);expect((await overview()).balance_minor).toBe('100000');
 // External Ads API traffic is replaced by a clearly fictional immutable response.
 const report={version:'ads-readonly-v1',account:{id:'adacct_fictional_loop',name:'FICTIONAL LOOP ACCOUNT',currency_code:'CAD',timezone:'America/Vancouver'},since:'2024-01-01',until:'2024-01-31',check:'matched',missingDates:[],endBoundary:'exclusive',dailySpendMicros:'100000000',periodSpendMicros:'100000000',rawSha256:'a'.repeat(64),daily:Array.from({length:31},(_,i)=>({date:`2024-01-${String(i+1).padStart(2,'0')}`,spendMicros:i===0?'100000000':'0',impressions:i===0?'100':'0',clicks:i===0?'10':'0'})),rawResponses:[{path:'/ad_account/insights',body:'FICTIONAL PRIVATE API RESPONSE'}]};
 const source=(await as('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).id;
 const binding=(await as('1',"select public.bind_ads_reporting_account($1,$2,'FICTIONAL AUTHORIZATION') id",[source,org])).id;
 await as('1',"select public.share_ads_source_snapshot($1,$2,'FICTIONAL FULL MONTH SOURCE')",[source,binding]);expect((await overview()).accounts[0].stage).toBe('quote_needed');
 const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};const q=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period:'2024-01-01',sourceCadMinor:'10000',rateMode:'manual',rate:'5',canada:rule,china:{...rule,basis:'upstream_total'},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'FICTIONAL AGREED TERMS'});expect(q.finalMinor).toBe('60500');expect(q.upstreamCadMinor).toBe('11000');
 const quote=(await as('1',"select public.save_agency_quote_snapshot($1,'2024-01-01',$2,$3,$4) id",[org,randomUUID(),'b'.repeat(64),JSON.stringify(q)])).id;
 const draft=(await as('2',"select public.prepare_monthly_settlement($1,$2,'FICTIONAL AGREEMENT','FICTIONAL PREPARATION') id",[source,quote])).id;
 expect((await overview()).accounts[0].stage).toBe('settlement_review_needed');await as('3',"select public.review_monthly_settlement($1,'approved','Independent source and fee verification')",[draft]);expect((await overview()).accounts[0].stage).toBe('publication_ready');
 const statement=(await as('1',"select public.publish_monthly_statement($1,'虚构验收案例：广告与约定服务费',$2) id",[draft,JSON.stringify(q)])).id;await as('1',"select public.publish_monthly_statement($1,'虚构验收案例：广告与约定服务费',$2)",[draft,JSON.stringify(q)]);
 originalStatement=String(statement);const closed=await overview();expect(closed.balance_minor).toBe('39500');
 const summaries=(await as('4','select public.get_client_statement_summaries() data')).data;expect(summaries).toEqual([]);
 expect(closed.accounts[0].stage).toBe('published');expect((await as('4','select public.get_client_monthly_statements() data')).data).toEqual([]);
 await as('1',"select public.set_client_access($1,'a0000000-0000-4000-8000-000000000004','grant_viewer')",[org]);await as('1',"select public.set_crm_finance_access($1,'a0000000-0000-4000-8000-000000000004','viewer')",[org]);
 const client=clientStatementSchema.array().parse((await as('4','select public.get_client_monthly_statements() data')).data);expect(client).toHaveLength(1);expect(client[0].id).toBe(statement);expect(statementCsv(client[0],true)).toContain('605.00');expect(statementHtml(client[0],true)).toContain('请勿重复支付');expect(JSON.stringify(client)).not.toMatch(/PRIVATE|rate|sourceCadMinor|private_snapshot/);
 const customerTotals=(await as('4','select public.get_client_statement_summaries() data')).data as Array<Record<string,unknown>>;expect(customerTotals).toEqual([expect.objectContaining({wallet_id:wallet,statement_count:1,total_minor:'60500',advertising_service_minor:'55000',operating_other_minor:'5500'})]);
 const filtered=clientStatementSchema.array().parse((await as('4','select public.get_client_monthly_statements($1,$2,$3) data',[wallet,'2024-01-01',statement])).data);expect(filtered).toHaveLength(1);expect(filtered[0].wallet_id).toBe(wallet);
 expect((await as('4','select public.get_client_monthly_statements($1,$2,$3) data',[randomUUID(),'2024-01-01',statement])).data).toEqual([]);
 expect((await as('3','select public.get_client_statement_summaries() data')).data).toEqual([]);
 // Linked questions reuse the service workflow and never create a second charge.
 const questionKey=randomUUID();const questionArgs=[statement,questionKey,'FICTIONAL BILL QUESTION','Please explain the agreed service fee.'];
 const question=(await as('4','select public.create_statement_question($1,$2,$3,$4) id',questionArgs)).id;
 expect((await as('4','select public.create_statement_question($1,$2,$3,$4) id',questionArgs)).id).toBe(question);
 await expect(as('4','select public.create_statement_question($1,$2,$3,$4)',[statement,questionKey,'DIFFERENT QUESTION','Please explain the agreed service fee.'])).rejects.toThrow(/Request key conflict/);
 const linked=(await as('4','select statement_id,statement_month::text,category,status from public.service_requests where id=$1',[question]));expect(linked).toMatchObject({statement_id:statement,category:'billing',status:'open'});expect(String(linked.statement_month)).toBe('2024-01-01');
 expect((await db.query<{n:number}>('select count(*)::int n from public.service_request_messages where request_id=$1',[question])).rows[0].n).toBe(1);
 expect((await db.query<{n:number}>("select count(*)::int n from public.audit_events where entity_type='service_request' and entity_id=$1",[question])).rows[0].n).toBe(1);
 await expect(as('1','select public.create_statement_question($1,$2,$3,$4)',[statement,randomUUID(),'FORGED STAFF QUESTION','Should never be a client question.'])).rejects.toThrow(/Forbidden/);
 expect((await as('5','select count(*)::int n from public.service_requests where id=$1',[question])).n).toBe(0);
 await expect(as('5',"select public.reply_service_request($1,'Forged reply','resolved')",[question])).rejects.toThrow(/Forbidden/);
 const answerArgs=[question,randomUUID(),'The original agreed service fee was checked.','resolved'];const answer=(await as('3','select public.reply_service_request_once($1,$2,$3,$4) data',answerArgs)).data as Record<string,unknown>;expect(answer.request_id).toBe(question);expect(answer.replayed).toBe(false);expect((await as('3','select public.reply_service_request_once($1,$2,$3,$4) data',answerArgs)).data).toEqual({...answer,replayed:true});
 expect((await as('4','select status from public.service_requests where id=$1',[question])).status).toBe('resolved');
 const resolvedQuestions=statementQuestionWorkbench.parse((await as('3',"select public.get_statement_question_workbench($1,'2024-01-01') data",[org])).data);expect(resolvedQuestions.open_count).toBe(0);expect(resolvedQuestions.resolved_count).toBe(1);
 const followupArgs=[question,randomUUID(),'I still have a follow-up question.','resolved'];await as('4','select public.reply_service_request_once($1,$2,$3,$4)',followupArgs);
 expect((await as('3','select status from public.service_requests where id=$1',[question])).status).toBe('open');
 const pendingQuestions=statementQuestionWorkbench.parse((await as('3',"select public.get_statement_question_workbench($1,'2024-01-01') data",[org])).data);expect(pendingQuestions.open_count).toBe(1);expect(pendingQuestions.rows[0].id).toBe(question);expect(JSON.stringify(pendingQuestions)).not.toContain('Please explain');
 await expect(as('4',"select public.get_statement_question_workbench($1,'2024-01-01')",[org])).rejects.toThrow(/Forbidden/);
 const wrongMonth=statementQuestionWorkbench.parse((await as('3',"select public.get_statement_question_workbench($1,'2024-02-01') data",[org])).data);expect(wrongMonth.total_count).toBe(0);
 expect((await as('4','select count(*)::int n from public.service_request_messages where request_id=$1',[question])).n).toBe(3);
 expect((await overview()).balance_minor).toBe('39500');
 const pendingRead=(await as('4','select public.get_client_statement_read_receipts($1) data',[[statement]])).data;expect(pendingRead).toEqual([]);
 await expect(as('1','select public.confirm_client_statement_read($1)',[statement])).rejects.toThrow(/Client account/);
 const acknowledged=(await as('4','select public.confirm_client_statement_read($1) data',[statement])).data;
 expect((await as('4','select public.confirm_client_statement_read($1) data',[statement])).data).toEqual(acknowledged);
 const otherOrg='b0000000-0000-4000-8000-000000000002';await db.query("insert into public.organizations(id,name) values($1,'OTHER FICTIONAL READ CLIENT')",[otherOrg]);
 await as('1',"select public.set_client_access($1,'a0000000-0000-4000-8000-000000000005','grant_viewer')",[otherOrg]);await as('1',"select public.set_crm_finance_access($1,'a0000000-0000-4000-8000-000000000005','viewer')",[otherOrg]);
 await expect(as('5','select public.confirm_client_statement_read($1)',[statement])).rejects.toThrow(/Forbidden/);
 await expect(as('5','select public.create_statement_question($1,$2,$3,$4)',[statement,randomUUID(),'CROSS COMPANY QUESTION','Should not be visible or created.'])).rejects.toThrow(/Forbidden/);
 await as('1',"select public.set_client_access($1,'a0000000-0000-4000-8000-000000000005','grant_viewer')",[org]);await as('1',"select public.set_crm_finance_access($1,'a0000000-0000-4000-8000-000000000005','viewer')",[org]);
 expect((await as('5','select public.get_client_statement_read_receipts($1) data',[[statement]])).data).toEqual([]);
 await expect(as('4',"select public.get_statement_read_status($1,'2024-01-01')",[org])).rejects.toThrow(/Forbidden/);
 await expect(as('4','select * from public.client_statement_read_receipts')).rejects.toThrow(/permission denied/);
 const clientRead=statementReadStatus.parse((await as('3',"select public.get_statement_read_status($1,'2024-01-01') data",[org])).data);expect(clientRead.statements[0].confirmation_count).toBe(1);expect(JSON.stringify(clientRead)).not.toMatch(/user_id|PRIVATE|rate|phone/);expect((await db.query<{n:number}>("select count(*)::int n from public.audit_events where entity_type='client_statement_read'")).rows[0].n).toBe(1);
 const payment=(await as('2',"select public.submit_upstream_payment($1,$2,'FICTIONAL-CAD-RECEIPT','2024-02-01','11000','FICTIONAL CAD BANK ORIGINAL',$3,'FICTIONAL VERIFIED NET CAD',$4) id",[randomUUID(),org,'c'.repeat(64),JSON.stringify([{statementId:statement,amountMinor:'11000'}])])).id;
 const pending=upstreamPaymentWorkbench.parse((await as('3',"select public.get_upstream_payment_workbench($1,'2024-01-01') data",[org])).data);expect(mainFlow(closed,{financeAccess:true,payments:pending},true)[4].state).toBe('pending');
 await as('3',"select public.review_upstream_payment($1,'approved','Independent CAD original and allocation verification')",[payment]);await as('3',"select public.review_upstream_payment($1,'approved','Independent CAD original and allocation verification')",[payment]);
 const paid=upstreamPaymentWorkbench.parse((await as('3',"select public.get_upstream_payment_workbench($1,'2024-01-01') data",[org])).data);expect(paid.statements[0].verified_cad_minor).toBe('11000');expect(mainFlow(closed,{financeAccess:true,payments:paid,clientRead},true).every(s=>s.state==='ready')).toBe(true);
 const checklist=buildMonthCloseChecklist({organizationId:org,organizationName:'FICTIONAL BUSINESS LOOP',month:'2024-01-01',overview:await overview(),payments:paid,reads:clientRead,questions:(await as('3',"select public.get_statement_question_workbench($1,'2024-01-01') data",[org])).data,generatedAt:new Date().toISOString()});
 expect(checklist).not.toBeNull();expect(checklist!.questions.open_count).toBe(1);expect(monthCloseChecklistCsv(checklist!,true)).toContain('605.00');expect(monthCloseChecklistCsv(checklist!,true)).toContain('110.00');expect(JSON.stringify(checklist)).not.toMatch(/FICTIONAL-CAD-RECEIPT|private_snapshot|evidence_sha256|prepared_by/);
 expect((await overview()).balance_minor).toBe('39500');expect((await db.query<{n:number}>('select count(*)::int n from public.wallet_entries')).rows[0].n).toBe(3);
 await as('1',"select public.set_crm_finance_access($1,'a0000000-0000-4000-8000-000000000004','none')",[org]);expect((await as('4','select public.get_client_monthly_statements() data')).data).toEqual([]);
 expect((await as('4','select public.get_client_statement_read_receipts($1) data',[[statement]])).data).toEqual([]);
 expect((await as('4','select count(*)::int n from public.service_requests where id=$1',[question])).n).toBe(0);
 await expect(as('4','select public.create_statement_question($1,$2,$3,$4)',questionArgs)).rejects.toThrow(/Forbidden/);
 await expect(as('4',"select public.reply_service_request($1,'Access revoked follow-up','open')",[question])).rejects.toThrow(/Forbidden/);
 await expect(as('4','select public.reply_service_request_once($1,$2,$3,$4)',followupArgs)).rejects.toThrow(/Forbidden/);
 await expect(as('4','select public.confirm_client_statement_read($1)',[statement])).rejects.toThrow(/Forbidden/);
 expect((await db.query<{n:number}>('select count(*)::int n from public.client_statement_read_receipts')).rows[0].n).toBe(1);
 expect((await as('3',"select public.get_statement_read_status($1,'2024-01-01') data",[org])).data).toEqual(clientRead);
},30000);

it('aggregates all advertisers in the latest wallet month and can locate an older statement by exact ID',async()=>{
 await as('1',"select public.set_crm_finance_access($1,'a0000000-0000-4000-8000-000000000004','viewer')",[org]);
 const canada={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:0,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};const china={...canada,mode:'fixed' as const,fixedMinor:'100',waiveWhenZero:false};
 const q=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period:'2024-02-01',sourceCadMinor:'0',rateMode:'manual',rate:'5',canada,china,transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'FICTIONAL AGREED FIXED MONTHLY SERVICE'});
 for(let n=0;n<2;n++){
  const report={version:'ads-readonly-v1',account:{id:'adacct_fictional_summary_'+n,name:'FICTIONAL SUMMARY ACCOUNT '+n,currency_code:'CAD',timezone:'UTC'},since:'2024-02-01',until:'2024-02-29',check:'matched',missingDates:[],endBoundary:'exclusive',dailySpendMicros:'0',periodSpendMicros:'0',rawSha256:'d'.repeat(64),daily:Array.from({length:29},(_,i)=>({date:`2024-02-${String(i+1).padStart(2,'0')}`,spendMicros:'0',impressions:'0',clicks:'0'})),rawResponses:[{path:'/ad_account/insights',body:'FICTIONAL ZERO ACTIVITY MONTH'}]};
  const source=(await as('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).id;
  const binding=(await as('1',"select public.bind_ads_reporting_account($1,$2,'FICTIONAL SUMMARY AUTHORIZATION') id",[source,org])).id;await as('1',"select public.share_ads_source_snapshot($1,$2,'FICTIONAL SUMMARY SOURCE')",[source,binding]);
  const quote=(await as('1',"select public.save_agency_quote_snapshot($1,'2024-02-01',$2,$3,$4) id",[org,randomUUID(),'e'.repeat(64),JSON.stringify(q)])).id;
  const draft=(await as('2',"select public.prepare_monthly_settlement($1,$2,'FICTIONAL FIXED FEE TERMS','FICTIONAL SUMMARY PREPARATION') id",[source,quote])).id;await as('3',"select public.review_monthly_settlement($1,'approved','Independent fixed service fee review')",[draft]);await as('1',"select public.publish_monthly_statement($1,'虚构案例：按约定固定月费',$2)",[draft,JSON.stringify(q)]);
 }
 const totals=(await as('4','select public.get_client_statement_summaries() data')).data;expect(totals).toEqual([expect.objectContaining({month:'2024-02-01',statement_count:2,advertising_service_minor:'0',operating_other_minor:'200',total_minor:'200'})]);
 const older=clientStatementSchema.array().parse((await as('4','select public.get_client_monthly_statements(null,null,$1) data',[originalStatement])).data);expect(older).toHaveLength(1);expect(older[0].month).toBe('2024-01-01');
 const month=clientStatementSchema.array().parse((await as('4',"select public.get_client_monthly_statements(null,'2024-02-01',null) data")).data);expect(month).toHaveLength(2);expect(month.every(s=>s.month==='2024-02-01')).toBe(true);
});

it('keeps linked requests immutable, isolates billing visibility and retries safely at the open-request limit',async()=>{
 const general=(await as('4',"select public.create_service_request($1,'billing','FICTIONAL GENERAL QUESTION','A general unlinked billing question.') id",[org])).id;
 expect((await as('4','select statement_id from public.service_requests where id=$1',[general])).statement_id).toBeNull();
 await as('3',"select public.reply_service_request($1,'General question checked.','resolved')",[general]);
 const request=(await db.query<{id:string;statement_request_key:string;statement_id:string;subject:string}>("select id,statement_request_key,statement_id,subject from public.service_requests where statement_id=$1",[originalStatement])).rows[0];
 await expect(db.query("update public.service_requests set statement_month='2024-02-01' where id=$1",[request.id])).rejects.toThrow(/association is immutable/);
 const sourceUser='a0000000-0000-4000-8000-000000000006';await db.exec(`insert into auth.users(id) values('${sourceUser}');insert into public.staff_members(user_id,role) values('${sourceUser}','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('${sourceUser}','kbjm_ca','ad_operations');`);
 await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${sourceUser}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);
 expect((await db.query('select id from public.service_requests')).rows).toHaveLength(0);await db.exec('rollback');
 await expect(as('4',"select statement_request_key from public.service_requests")).rejects.toThrow(/permission denied/);
 await db.query(`insert into public.service_requests(organization_id,category,subject,created_by) select $1,'other','FICTIONAL LIMIT REQUEST '||n,'a0000000-0000-4000-8000-000000000004' from generate_series(1,20-(select count(*)::int from public.service_requests where organization_id=$1 and status<>'resolved'))n`,[org]);
 await expect(as('4','select public.create_statement_question($1,$2,$3,$4)',[originalStatement,randomUUID(),'A NEW BILL QUESTION','Please explain another fictional item.'])).rejects.toThrow(/Open request limit/);
 expect((await as('4','select public.create_statement_question($1,$2,$3,$4) id',[originalStatement,request.statement_request_key,request.subject,'Please explain the agreed service fee.'])).id).toBe(request.id);
 expect((await db.query<{n:number}>("select count(*)::int n from public.audit_events where entity_type='service_request' and entity_id=$1 and operation='INSERT'",[request.id])).rows[0].n).toBe(1);
});

it('counts all monthly statement questions while prioritizing pending work before the 100-row limit',async()=>{
 const linked=(await db.query<{id:string;statement_id:string;statement_month:string}>("select id,statement_id,statement_month::text from public.service_requests where statement_id=$1",[originalStatement])).rows[0];
 const before=(await db.query('select count(*)::int n from public.wallet_entries')).rows[0];
 await db.query(`insert into public.service_requests(organization_id,category,subject,status,created_by,statement_id,statement_month,statement_request_key,statement_input_sha256) select $1,'billing','FICTIONAL RESOLVED '||n,'resolved','a0000000-0000-4000-8000-000000000004',$2,'2024-01-01',gen_random_uuid(),repeat('a',64) from generate_series(1,105)n`,[org,originalStatement]);
 const report=statementQuestionWorkbench.parse((await as('3',"select public.get_statement_question_workbench($1,'2024-01-01') data",[org])).data);expect(report.total_count).toBe(106);expect(report.open_count).toBe(1);expect(report.resolved_count).toBe(105);expect(report.rows).toHaveLength(100);expect(report.truncated).toBe(true);expect(report.rows[0].id).toBe(linked.id);expect(JSON.stringify(report)).not.toMatch(/statement_input_sha256|statement_request_key|Please explain/);
 const otherOrg='b0000000-0000-4000-8000-000000000002';const other=statementQuestionWorkbench.parse((await as('3',"select public.get_statement_question_workbench($1,'2024-01-01') data",[otherOrg])).data);expect(other.total_count).toBe(0);
 await expect(as('3',"select public.get_statement_question_workbench($1,'2024-01-02')",[org])).rejects.toThrow(/Month must/);
 const source='a0000000-0000-4000-8000-000000000006';await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','${source}',true);select set_config('request.jwt.claims','{"aal":"aal2"}',true);`);
 await expect(db.query("select public.get_statement_question_workbench($1,'2024-01-01')",[org])).rejects.toThrow(/Forbidden/);await db.exec('rollback');
 await db.exec("begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{\"aal\":\"aal1\"}',true);");
 await expect(db.query("select public.get_statement_question_workbench($1,'2024-01-01')",[org])).rejects.toThrow(/Forbidden/);await db.exec('rollback');
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows[0]).toEqual(before);
});

it('reveals combined funding gaps and preserves the database guard when one of two reviewed bills is published',async()=>{
 const canada={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:0,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};const china={...canada,mode:'fixed' as const,fixedMinor:'25000',waiveWhenZero:false};
 const q=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period:'2024-03-01',sourceCadMinor:'0',rateMode:'manual',rate:'5',canada,china,transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'FICTIONAL COMBINED FUNDING TEST TERMS'});
 const drafts:unknown[]=[];
 for(let n=0;n<2;n++){
 const report={version:'ads-readonly-v1',account:{id:'adacct_fictional_funding_'+n,name:'FICTIONAL FUNDING ACCOUNT '+n,currency_code:'CAD',timezone:'UTC'},since:'2024-03-01',until:'2024-03-31',check:'matched',missingDates:[],endBoundary:'exclusive',dailySpendMicros:'0',periodSpendMicros:'0',rawSha256:'f'.repeat(64),daily:Array.from({length:31},(_,i)=>({date:`2024-03-${String(i+1).padStart(2,'0')}`,spendMicros:'0',impressions:'0',clicks:'0'})),rawResponses:[{path:'/ad_account/insights',body:'FICTIONAL FUNDING SOURCE'}]};
 const source=(await as('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).id;const binding=(await as('1',"select public.bind_ads_reporting_account($1,$2,'FICTIONAL FUNDING AUTHORIZATION') id",[source,org])).id;await as('1',"select public.share_ads_source_snapshot($1,$2,'FICTIONAL FUNDING HANDOFF')",[source,binding]);
 const quote=(await as('1',"select public.save_agency_quote_snapshot($1,'2024-03-01',$2,$3,$4) id",[org,randomUUID(),'a'.repeat(64),JSON.stringify(q)])).id;
 const draft=(await as('2',"select public.prepare_monthly_settlement($1,$2,'FICTIONAL AGREED TERMS','FICTIONAL FUNDING PREPARATION') id",[source,quote])).id;await as('3',"select public.review_monthly_settlement($1,'approved','Independent fictional funding review')",[draft]);drafts.push(draft);
 }
 const current=async()=>(await as('3',"select public.get_month_close_overview($1,'2024-03-01') data",[org])).data as CloseOverview;
 const before=await current();expect(before.balance_minor).toBe('39300');const combined=monthFunding(before)!;expect(combined.approved_count).toBe(2);expect(combined.approved_minor).toBe('50000');expect(combined.shortfall_minor).toBe('10700');expect(before.accounts.filter(a=>a.stage==='publication_ready')).toHaveLength(2);expect(mainFlow(before,{financeAccess:null,payments:null},true)[0].state).toBe('pending');
 const initialPreview=publicationPreview(before,{organizationId:org,month:'2024-03-01',draftId:String(drafts[0]),amountMinor:'25000'});expect(initialPreview?.remaining_minor).toBe('14300');
 const rowsBefore=(await db.query<{n:number}>('select count(*)::int n from public.wallet_entries')).rows[0].n;
 await as('1',"select public.publish_monthly_statement($1,'虚构案例：第一份独立发布',$2)",[drafts[0],JSON.stringify(q)]);
 const after=await current(),remaining=monthFunding(after)!;expect(after.balance_minor).toBe('14300');expect(remaining.approved_count).toBe(1);expect(remaining.approved_minor).toBe('25000');expect(remaining.shortfall_minor).toBe('10700');
 const secondPreview=publicationPreview(after,{organizationId:org,month:'2024-03-01',draftId:String(drafts[1]),amountMinor:'25000'});expect(secondPreview?.remaining_minor).toBe('-10700');
 await expect(as('1',"select public.publish_monthly_statement($1,'虚构案例：余额不足不发布',$2)",[drafts[1],JSON.stringify(q)])).rejects.toThrow(/Insufficient/);
 expect((await current()).balance_minor).toBe('14300');expect((await db.query<{n:number}>('select count(*)::int n from public.wallet_entries')).rows[0].n).toBe(rowsBefore+1);
},30000);

it('exports actual CAD allocation state before and after a whole-batch reversal without changing client funds',async()=>{
 const payment=(await db.query<{id:string}>("select id from public.upstream_payment_records where bank_reference='FICTIONAL-CAD-RECEIPT'")).rows[0].id;
 const beforeBalance=(await overview()).balance_minor;const countBefore=(await db.query<{n:number}>('select count(*)::int n from public.wallet_entries')).rows[0].n;
 const read=async()=>buildCadAllocationReport({organizationId:org,organizationName:'FICTIONAL CAD REPORT',month:'2024-01-01',data:(await as('3',"select public.get_upstream_payment_workbench($1,'2024-01-01') data",[org])).data,generatedAt:new Date().toISOString()});
 const before=await read();expect(before?.verified_minor).toBe('11000');expect(before?.remaining_minor).toBe('0');expect(cadAllocationReportCsv(before!,true)).toContain('FICTIONAL-CAD-RECEIPT');expect(JSON.stringify(before)).not.toMatch(/FICTIONAL CAD BANK ORIGINAL|prepared_by|evidence_sha256/);
 const reversal=(await as('2',"select public.submit_upstream_reversal($1,$2,'FICTIONAL REPORT REVERSAL','FICTIONAL REVERSAL ORIGINAL',$3) id",[payment,randomUUID(),'b'.repeat(64)])).id;
 const pending=await read();expect(pending?.verified_minor).toBe('11000');expect(pending?.pending_reversal_count).toBe(1);
 await as('3',"select public.review_upstream_reversal($1,'approved','Independent fictional reversal evidence checked')",[reversal]);
 const reversed=await read();expect(reversed?.verified_minor).toBe('0');expect(reversed?.remaining_minor).toBe('11000');expect(reversed?.registrations[0].reversed).toBe(true);expect(reversed?.allocations[0].verified_minor).toBe('0');expect((await overview()).balance_minor).toBe(beforeBalance);expect((await db.query<{n:number}>('select count(*)::int n from public.wallet_entries')).rows[0].n).toBe(countBefore);
});
