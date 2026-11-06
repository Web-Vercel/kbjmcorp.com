import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
let db:PGlite;
const admin="11111111-aaaa-4111-8111-111111111111";
const operator="22222222-aaaa-4222-8222-222222222222";
const disabled="33333333-aaaa-4333-8333-333333333333";
const alice="44444444-aaaa-4444-8444-444444444444";
const bob="55555555-aaaa-4555-8555-555555555555";
const orgA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const accountA="aaaaaaaa-1111-4111-8111-111111111111";
let inquiryId:string;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 insert into auth.users values('${admin}'),('${operator}'),('${disabled}'),('${alice}'),('${bob}');`);
 const dir=new URL("../supabase/migrations/",import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 await db.exec(`insert into public.staff_members(user_id,role,active) values('${admin}','admin',true),('${operator}','operator',true),('${disabled}','admin',false);
 insert into public.organizations(id,name) values('${orgA}','Fixture A'),('${orgB}','Fixture B');
 insert into public.memberships values('${orgA}','${alice}','owner'),('${orgB}','${bob}','viewer');
 insert into public.ad_accounts(id,organization_id,platform,external_id,label) values('${accountA}','${orgA}','openai_ads','fixture-account-A','Fixture account A');
 insert into public.projects(organization_id,name,created_by) values('${orgA}','Project A','${admin}'),('${orgB}','Project B','${admin}');`);
 const result=await db.query<{id:string}>("insert into public.inquiries(company,phone_e164,message,locale,consent_at,consent_version) values('Phone-only fixture','+8613800138000','A sample requirement used only in tests','zh',now(),'inquiry-v2') returning id");inquiryId=result.rows[0].id;
},30000);
afterAll(async()=>{await db?.close();});
async function asUser<T>(id:string,aal:"aal1"|"aal2",sql:string,params:unknown[]=[]){return db.transaction(async tx=>{
 await tx.exec('set local role authenticated');
 await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[id,JSON.stringify({sub:id,aal})]);
 return tx.query<T>(sql,params);
});}
describe("Staff membership and second-factor boundaries",()=>{
 it("requires active staff membership AND aal2 for private CRM data",async()=>{
  expect((await asUser(alice,'aal2','select * from public.inquiries')).rows).toEqual([]);
  expect((await asUser(disabled,'aal2','select * from public.inquiries')).rows).toEqual([]);
  expect((await asUser(admin,'aal1','select * from public.inquiries')).rows).toEqual([]);
  expect((await asUser(admin,'aal2','select * from public.inquiries')).rows).toHaveLength(1);
 });
 it("clients cannot self-promote or alter staff membership",async()=>{
  await expect(asUser(alice,'aal2',"insert into public.staff_members(user_id,role) values($1,'admin')",[alice])).rejects.toThrow(/permission denied/);
  await expect(asUser(operator,'aal2',"update public.staff_members set role='admin' where user_id=$1",[operator])).rejects.toThrow(/permission denied/);
 });
 it("staff can see only their own staff-identity row",async()=>{
  expect((await asUser<{user_id:string}>(admin,'aal1','select user_id from public.staff_members')).rows).toEqual([{user_id:admin}]);
 });
 it("company owners retain only their company's project visibility",async()=>{
  expect((await asUser<{name:string}>(alice,'aal2','select name from public.projects')).rows).toEqual([{name:'Project A'}]);
  expect((await asUser<{name:string}>(bob,'aal2','select name from public.projects')).rows).toEqual([{name:'Project B'}]);
  expect((await asUser(alice,'aal2',"update public.projects set status='active'")).affectedRows).toBe(0);
  expect((await asUser<{status:string}>(alice,'aal2',"select status from public.projects")).rows).toEqual([{status:"briefing"}]);
 });
 it("clients cannot see internal notes, sync runs or audit events",async()=>{
  for(const table of ['inquiry_notes','ad_sync_runs','audit_events'])expect((await asUser(alice,'aal2',`select * from public.${table}`)).rows).toEqual([]);
 });
});
describe("CRM conversion and protected audit trail",()=>{
 it("converts a phone-only lead atomically and idempotently without granting a login",async()=>{
  const sql="select public.convert_inquiry_to_client($1,$2) as id";
  const first=await asUser<{id:string}>(operator,'aal2',sql,[inquiryId,'Converted phone client']);
  const second=await asUser<{id:string}>(operator,'aal2',sql,[inquiryId,'Ignored duplicate name']);
  expect(second.rows[0].id).toBe(first.rows[0].id);
  const contacts=await db.query<{email:string|null;phone_e164:string}>("select email,phone_e164 from public.crm_contacts where inquiry_id=$1",[inquiryId]);
  expect(contacts.rows).toEqual([{email:null,phone_e164:'+8613800138000'}]);
  expect((await db.query<{count:number}>("select count(*)::integer as count from auth.users")).rows[0].count).toBe(5);
  expect((await db.query("select * from public.memberships where organization_id=$1",[first.rows[0].id])).rows).toEqual([]);
 });
 it("does not permit conversion from a client or aal1 session",async()=>{
  for(const [id,aal] of [[alice,'aal2'],[admin,'aal1']] as const)await expect(asUser(id,aal,"select public.convert_inquiry_to_client($1,'Forbidden conversion')",[inquiryId])).rejects.toThrow(/Forbidden/);
 });
 it("requires notes to belong to the verified author",async()=>{
  await asUser(operator,'aal2',"insert into public.inquiry_notes(inquiry_id,author_id,body) values($1,$2,$3)",[inquiryId,operator,'Private follow-up fixture']);
  await expect(asUser(operator,'aal2',"insert into public.inquiry_notes(inquiry_id,author_id,body) values($1,$2,'Spoofed author')",[inquiryId,admin])).rejects.toThrow(/row-level security/);
 });
 it("records server-attributed changes without copying private contact or message bodies",async()=>{
  await asUser(admin,'aal2',"update public.inquiries set status='closed' where id=$1",[inquiryId]);
  const result=await asUser<{actor_id:string;changes:unknown}>(admin,'aal2',"select actor_id,changes from public.audit_events where entity_id=$1 order by created_at desc",[inquiryId]);
  expect(result.rows.some(row=>row.actor_id===admin)).toBe(true);
  expect(JSON.stringify(result.rows)).not.toContain('13800138000');
  expect(JSON.stringify(result.rows)).not.toContain('sample requirement');
  await expect(asUser(admin,'aal2',"update public.audit_events set operation='DELETE'")).rejects.toThrow(/permission denied/);
 });
 it("rejects converting a closed, unconverted inquiry",async()=>{
  const lead=await db.query<{id:string}>("insert into public.inquiries(company,email,message,locale,status,consent_at,consent_version) values('Closed fixture','fixture@example.com','Closed lead should not convert','en','closed',now(),'inquiry-v2') returning id");
  await expect(asUser(admin,'aal2',"select public.convert_inquiry_to_client($1,'Not created')",[lead.rows[0].id])).rejects.toThrow(/Closed inquiry/);
 });
});
describe("External account mapping boundaries",()=>{
 it("operators cannot create an external account link",async()=>{
  await expect(asUser(operator,'aal2',"insert into public.ad_accounts(organization_id,platform,external_id,label) values($1,'openai_ads','operator-forbidden','Forbidden')",[orgA])).rejects.toThrow(/row-level security/);
 });
 it("a new admin link remains unverified with no fake synchronization date",async()=>{
  await asUser(admin,'aal2',"insert into public.ad_accounts(organization_id,platform,external_id,label) values($1,'openai_ads','fixture-account-B','Fixture account B')",[orgB]);
  const result=await asUser<{connection_status:string;last_synced_at:null;source_type:string}>(admin,'aal2',"select connection_status,last_synced_at,source_type from public.ad_accounts where external_id='fixture-account-B'");
  expect(result.rows).toEqual([{connection_status:'unverified',last_synced_at:null,source_type:'manual'}]);
 });
 it("prevents one real external identity from being linked to two clients",async()=>{
  await expect(asUser(admin,'aal2',"insert into public.ad_accounts(organization_id,platform,external_id,label) values($1,'openai_ads','fixture-account-A','Duplicate')",[orgB])).rejects.toThrow(/unique constraint/);
 });
 it("blocks cross-organization project/account links",async()=>{
  await expect(asUser(admin,'aal2',"insert into public.projects(organization_id,ad_account_id,name,created_by) values($1,$2,'Wrong company',$3)",[orgB,accountA,admin])).rejects.toThrow(/foreign key/);
 });
 it("does not let browser writes fabricate connected or synced state",async()=>{
  await expect(asUser(admin,'aal2',"insert into public.ad_accounts(organization_id,platform,external_id,label,connection_status) values($1,'openai_ads','fake-connected','Fake','connected')",[orgA])).rejects.toThrow(/permission denied/);
 });
});

describe("End-to-end local business workflow and client access",()=>{
 it("converts an inquiry, creates a project, grants verified access and revokes it",async()=>{
  const lead=await db.query<{id:string}>("insert into public.inquiries(company,phone_e164,message,locale,consent_at,consent_version) values('Local workflow fixture','+8613900139000','Fictional workflow requirement','zh',now(),'inquiry-v2') returning id");
  const converted=await asUser<{id:string}>(admin,'aal2',"select public.convert_inquiry_to_client($1,'Workflow client') as id",[lead.rows[0].id]);const org=converted.rows[0].id;
  const project=await asUser<{id:string}>(admin,'aal2',"insert into public.projects(organization_id,name,target_market,created_by) values($1,'Workflow project','global',$2) returning id",[org,admin]);
  expect((await asUser(alice,'aal1','select * from public.projects where id=$1',[project.rows[0].id])).rows).toEqual([]);
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_viewer')",[org,alice]);
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_viewer')",[org,alice]);
  expect((await db.query("select * from public.memberships where organization_id=$1",[org])).rows).toHaveLength(1);
  await asUser(operator,'aal2',"update public.projects set status='review' where id=$1",[project.rows[0].id]);
  expect((await asUser<{status:string}>(alice,'aal1','select status from public.projects where id=$1',[project.rows[0].id])).rows).toEqual([{status:'review'}]);
  expect((await asUser(bob,'aal1','select * from public.projects where id=$1',[project.rows[0].id])).rows).toEqual([]);
  expect((await asUser(alice,'aal1','select * from public.inquiry_notes')).rows).toEqual([]);
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'revoke')",[org,alice]);
  expect((await asUser(alice,'aal1','select * from public.projects where id=$1',[project.rows[0].id])).rows).toEqual([]);
  expect((await asUser(alice,'aal1','select * from public.organizations where id=$1',[org])).rows).toEqual([]);
  const audits=await db.query<{operation:string}>("select operation from public.audit_events where entity_type='client_access' and entity_id=$1 order by created_at",[org]);expect(audits.rows.map(r=>r.operation)).toEqual(['INSERT','DELETE']);
 });
 it("does not permit clients, operators or password-only staff to assign access",async()=>{
  for(const [id,aal] of [[alice,'aal2'],[operator,'aal2'],[admin,'aal1'],[disabled,'aal2']] as const)await expect(asUser(id,aal,"select public.set_client_access($1,$2,'grant_viewer')",[orgB,alice])).rejects.toThrow(/Forbidden/);
 });
 it("rejects nonexistent users and internal staff as client members",async()=>{
  for(const target of ['99999999-9999-4999-8999-999999999999',operator])await expect(asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_viewer')",[orgA,target])).rejects.toThrow(/Invalid association|Staff identity/);
 });
 it("does not allow a browser to bypass the access RPC",async()=>{
  await expect(asUser(admin,'aal2',"insert into public.memberships values($1,$2,'owner')",[orgB,alice])).rejects.toThrow(/permission denied/);
 });
 it("keeps an existing membership's role on idempotent assignment",async()=>{
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_viewer')",[orgA,alice]);
  expect((await db.query<{role:string}>("select role from public.memberships where organization_id=$1 and user_id=$2",[orgA,alice])).rows[0].role).toBe('owner');
 });
});
describe("Versioned project collaboration",()=>{
 let projectId:string; let briefId:string; let creativeId:string;
 it("grants collaborator permission without granting staff rights",async()=>{
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_contributor')",[orgA,alice]);
  expect((await asUser<{allowed:boolean}>(alice,'aal1','select public.can_collaborate($1) as allowed',[orgA])).rows[0].allowed).toBe(true);
  expect((await asUser<{allowed:boolean}>(alice,'aal2','select public.has_staff_access() as allowed')).rows[0].allowed).toBe(false);
  const result=await asUser<{id:string}>(admin,'aal2',"insert into public.projects(organization_id,name,created_by) values($1,'Collaboration fixture',$2) returning id",[orgA,admin]);projectId=result.rows[0].id;
 });
 it("allows a verified client to submit a brief and staff to review it",async()=>{
  const result=await asUser<{id:string}>(alice,'aal1',"select public.submit_project_content($1,'brief','Fixture brief','Product and audience requirements','https://example.com/brief',0) as id",[projectId]);briefId=result.rows[0].id;
  await asUser(operator,'aal2',"select public.review_project_content($1,$2,'approved','Requirements understood')",[projectId,briefId]);
  const reviews=await asUser<{decision:string}>(alice,'aal1','select decision from public.project_reviews where submission_id=$1',[briefId]);expect(reviews.rows).toEqual([{decision:'approved'}]);
 });
 it("rejects self-review, wrong roles, read-only clients and cross-company writes",async()=>{
  await expect(asUser(alice,'aal1',"select public.review_project_content($1,$2,'approved','Self reviewed')",[projectId,briefId])).rejects.toThrow(/Forbidden action/);
  await expect(asUser(bob,'aal1',"select public.submit_project_content($1,'brief','Forbidden brief','Not the same company','',0)",[projectId])).rejects.toThrow(/Not available/);
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_viewer')",[orgA,bob]);
  await expect(asUser(bob,'aal1',"select public.submit_project_content($1,'brief','Viewer brief','Read only cannot submit','',1)",[projectId])).rejects.toThrow(/Not available/);
  await expect(asUser(admin,'aal1',"select public.submit_project_content($1,'creative','No MFA','Insufficient staff assurance','',0)",[projectId])).rejects.toThrow(/Not available/);
  await expect(asUser(admin,'aal2',"select public.submit_project_content($1,'brief','Staff brief','Wrong direction for staff','',1)",[projectId])).rejects.toThrow(/Forbidden action/);
 });
 it("keeps prior versions immutable and prevents stale confirmations",async()=>{
  const first=await asUser<{id:string}>(operator,'aal2',"select public.submit_project_content($1,'creative','Creative first','First proposal for review','',0) as id",[projectId]);
  const second=await asUser<{id:string}>(operator,'aal2',"select public.submit_project_content($1,'creative','Creative revised','Revised proposal for review','',1) as id",[projectId]);creativeId=second.rows[0].id;
  await expect(asUser(alice,'aal1',"select public.review_project_content($1,$2,'approved','Old version reviewed')",[projectId,first.rows[0].id])).rejects.toThrow(/Stale revision/);
  await expect(asUser(operator,'aal2',"select public.submit_project_content($1,'creative','Stale creative','Lost update should be blocked','',0)",[projectId])).rejects.toThrow(/Stale revision/);
  await expect(asUser(alice,'aal1',"update public.project_submissions set body='Overwritten'")).rejects.toThrow(/permission denied/);
  await expect(asUser(admin,'aal2',"delete from public.project_reviews")).rejects.toThrow(/permission denied/);
 });
 it("supports a client change request, revised creative and version-specific approval",async()=>{
  await asUser(alice,'aal1',"select public.review_project_content($1,$2,'changes_requested','Please refine the headline')",[projectId,creativeId]);
  await expect(asUser(alice,'aal1',"select public.review_project_content($1,$2,'approved','Duplicate review')",[projectId,creativeId])).rejects.toThrow(/Stale revision/);
  const revised=await asUser<{id:string}>(operator,'aal2',"select public.submit_project_content($1,'creative','Final creative','Refined headline and campaign copy','',2) as id",[projectId]);
  await asUser(alice,'aal1',"select public.review_project_content($1,$2,'approved','This version is approved')",[projectId,revised.rows[0].id]);
  expect((await asUser(alice,'aal1',"select id from public.project_submissions where project_id=$1",[projectId])).rows).toHaveLength(4);
 });
 it("publishes shared updates and a project-stage history without leaking identities",async()=>{
  await asUser(operator,'aal2',"select public.publish_project_update($1,'Creative review is complete')",[projectId]);
  await asUser(operator,'aal2',"update public.projects set status='ready' where id=$1",[projectId]);
  const history=await asUser<{event_type:string;detail:string}>(alice,'aal1','select event_type,detail from public.project_activity where project_id=$1',[projectId]);
  expect(history.rows).toContainEqual({event_type:'status',detail:'briefing:ready'});
  expect(history.rows).toContainEqual({event_type:'update',detail:'Creative review is complete'});
  await expect(asUser(alice,'aal1','select author_id from public.project_submissions')).rejects.toThrow(/permission denied/);
  await expect(asUser(alice,'aal1','select actor_id from public.project_activity')).rejects.toThrow(/permission denied/);
  await expect(asUser(alice,'aal1',"select public.publish_project_update($1,'Client spoofed update')",[projectId])).rejects.toThrow(/Forbidden/);
 });
 it("blocks activity reads from another company after access is revoked",async()=>{
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'revoke')",[orgA,bob]);
  for(const table of ['project_submissions','project_activity'])expect((await asUser(bob,'aal1',`select id from public.${table} where project_id=$1`,[projectId])).rows).toEqual([]);
  expect((await asUser(bob,'aal1','select id from public.project_reviews')).rows).toEqual([]);
 });
 it("does not write approvals into advertising accounts or change project stage",async()=>{
  expect((await db.query<{status:string}>('select status from public.projects where id=$1',[projectId])).rows[0].status).toBe('ready');
  expect((await db.query<{connection_status:string}>('select connection_status from public.ad_accounts where id=$1',[accountA])).rows[0].connection_status).toBe('unverified');
  const audits=await db.query<{changes:unknown}>("select changes from public.audit_events where entity_type='project_submission'");expect(JSON.stringify(audits.rows)).not.toContain('Product and audience');
 });
 it("closes collaboration on completed projects",async()=>{
  await asUser(admin,'aal2',"update public.projects set status='completed' where id=$1",[projectId]);
  await expect(asUser(alice,'aal1',"select public.submit_project_content($1,'brief','Closed brief','Cannot change a completed project','',1)",[projectId])).rejects.toThrow(/Project closed/);
 });
});
describe("Collaboration authority changes",()=>{
 it("upgrades a viewer to collaborator with an audit, without a staff role",async()=>{
  expect((await db.query<{role:string}>("select role from public.memberships where organization_id=$1 and user_id=$2",[orgB,bob])).rows[0].role).toBe('viewer');
  await asUser(admin,'aal2',"select public.set_client_access($1,$2,'grant_contributor')",[orgB,bob]);
  expect((await db.query<{role:string}>("select role from public.memberships where organization_id=$1 and user_id=$2",[orgB,bob])).rows[0].role).toBe('admin');
  expect((await asUser<{allowed:boolean}>(bob,'aal1','select public.can_collaborate($1) as allowed',[orgB])).rows[0].allowed).toBe(true);
  expect((await asUser<{allowed:boolean}>(bob,'aal2','select public.has_staff_access() as allowed')).rows[0].allowed).toBe(false);
  const audit=await db.query<{operation:string}>("select operation from public.audit_events where entity_type='client_access' and entity_id=$1 and changes->>'target_user_id'=$2 order by created_at desc",[orgB,bob]);expect(audit.rows[0].operation).toBe('UPDATE');
 });
});
describe("Agency funds and source-based monthly statements",()=>{
 let wallet:string;let report:string;
 it("requires explicit finance access, separate from company collaboration",async()=>{
  const result=await db.query<{id:string}>("insert into public.client_wallets(organization_id,currency) values($1,'CAD') returning id",[orgA]);wallet=result.rows[0].id;
  expect((await asUser(alice,'aal1','select * from public.get_client_wallets()')).rows).toEqual([]);
  await db.query("insert into public.finance_access(organization_id,user_id,role) values($1,$2,'manager')",[orgA,alice]);
  expect((await asUser<{balance_minor:string}>(alice,'aal1','select * from public.get_client_wallets()')).rows[0].balance_minor).toBe('0');
 });
 it("records a topup request without creating money or trusting a posted status",async()=>{
  await asUser(alice,'aal1',"select public.request_client_topup($1,100000,'fixture-reference')",[wallet]);
  expect((await asUser<{balance_minor:string}>(alice,'aal1','select * from public.get_client_wallets()')).rows[0].balance_minor).toBe('0');
  expect((await asUser<{status:string}>(alice,'aal1','select status from public.client_topups')).rows).toEqual([{status:'pending'}]);
  await expect(asUser(alice,'aal1',"update public.client_topups set status='credited'")).rejects.toThrow(/permission denied/);
  await expect(asUser(alice,'aal1',"insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CAD','topup',100000,'Fake credit','fake-credit')",[wallet,orgA])).rejects.toThrow(/permission denied/);
 });
 it("isolates funds from another company and read-only financial access cannot request topups",async()=>{
  expect((await asUser(bob,'aal1','select * from public.get_client_wallets()')).rows).toEqual([]);
  await expect(asUser(bob,'aal1',"select public.request_client_topup($1,100,'forbidden-reference')",[wallet])).rejects.toThrow(/Forbidden/);
  await db.query("update public.finance_access set role='viewer' where organization_id=$1 and user_id=$2",[orgA,alice]);
  await expect(asUser(alice,'aal1',"select public.request_client_topup($1,100,'readonly-reference')",[wallet])).rejects.toThrow(/Forbidden/);
  await db.query("update public.finance_access set role='manager' where organization_id=$1 and user_id=$2",[orgA,alice]);
 });
 it("derives balances exactly from posted entries and prevents overwriting history",async()=>{
  await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CAD','topup',100000,'Verified fixture credit','credit-1'),($1,$2,'CAD','ad_spend',-23500,'Platform fixture spend','report-1'),($1,$2,'CAD','service_fee',-1500,'Fixture agency fee','report-1')",[wallet,orgA]);
  const balance=await asUser<{balance_minor:string;credited_minor:string}>(alice,'aal1','select balance_minor,credited_minor from public.get_client_wallets()');expect(balance.rows).toEqual([{balance_minor:'75000',credited_minor:'100000'}]);
  await expect(db.query("update public.wallet_entries set amount_minor=999 where wallet_id=$1",[wallet])).rejects.toThrow(/immutable/);
  await expect(db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'USD','topup',100,'Cross currency','wrong-currency')",[wallet,orgA])).rejects.toThrow(/foreign key/);
  await expect(db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CAD','topup',100000,'Duplicate receipt','credit-1')",[wallet,orgA])).rejects.toThrow(/unique constraint/);
 });
 it("keeps drafts private and refuses publication without provenance, translation and reconciled details",async()=>{
  const result=await db.query<{id:string}>("insert into public.monthly_ad_reports(wallet_id,organization_id,currency,month,ad_spend_minor,source_language,source_filename,source_timezone) values($1,$2,'CAD','2026-10-01',23500,'en','fixture-source.csv','America/Toronto') returning id",[wallet,orgA]);report=result.rows[0].id;
  expect((await asUser(alice,'aal1','select id from public.monthly_ad_reports')).rows).toEqual([]);
  await expect(db.query('update public.monthly_ad_reports set published_at=now() where id=$1',[report])).rejects.toThrow();
  await db.query("insert into public.monthly_ad_report_lines(report_id,campaign,market,spend_minor) values($1,'Fixture campaign','Canada',23500)",[report]);
  await expect(db.query("update public.monthly_ad_reports set published_at=now(),source_storage_key='private/fixture.csv',source_sha256=repeat('a',64),reviewed_by=$2 where id=$1",[report,admin])).rejects.toThrow(/check constraint/);
  await db.query("update public.monthly_ad_reports set ad_account_id='aaaaaaaa-1111-4111-8111-111111111111',source_account_name='Fixture source account',translation_status='reviewed',summary_zh='虚构中文说明',source_storage_key='private/fixture.csv',source_sha256=repeat('a',64),reviewed_by=$2,published_at=now() where id=$1",[report,admin]);
  expect((await asUser(alice,'aal1','select id from public.monthly_ad_reports')).rows).toEqual([{id:report}]);
 });
 it("protects published statements, private source locations and other companies' reports",async()=>{
  await expect(asUser(alice,'aal1','select source_storage_key from public.monthly_ad_reports')).rejects.toThrow(/permission denied/);
  expect((await asUser(bob,'aal1','select id from public.monthly_ad_reports')).rows).toEqual([]);
  expect((await asUser(bob,'aal1','select * from public.monthly_ad_report_lines')).rows).toEqual([]);
  await expect(db.query("update public.monthly_ad_report_lines set spend_minor=0 where report_id=$1",[report])).rejects.toThrow(/immutable/);
  await expect(db.query("update public.monthly_ad_reports set summary_zh='覆盖内容' where id=$1",[report])).rejects.toThrow(/immutable/);
 });
});
describe("CNY settlement, locked quotes and disclosed fees",()=>{
 let wallet:string; let quote:string;let report:string;
 const confirmTime='2026-11-04T08:00:00Z';
 it("requires original CAD detail and records a locked non-demo quote",async()=>{
  wallet=(await db.query<{id:string}>("insert into public.client_wallets(organization_id) values($1) returning id",[orgA])).rows[0].id;
  expect((await db.query<{currency:string}>('select currency from public.client_wallets where id=$1',[wallet])).rows[0].currency).toBe('CNY');
  quote=(await db.query<{id:string}>("insert into public.billing_fx_quotes(cad_cny_rate,value_date,quoted_at,source_name) values('5.20000000','2026-11-04','2026-11-04T02:00:00Z','Test-only verified quote fixture') returning id")).rows[0].id;
  report=(await db.query<{id:string}>("insert into public.monthly_ad_reports(wallet_id,organization_id,currency,month,ad_spend_minor,service_fee_minor,source_language,translation_status,source_filename,source_timezone,source_storage_key,source_sha256,summary_zh,reviewed_by,ad_account_id,source_account_name,source_currency,source_ad_spend_minor,fx_quote_id,settlement_date) values($1,$2,'CNY','2026-10-01',1222000,0,'en','reviewed','fixture-CAD.csv','America/Toronto','private/fixture-CAD.csv',repeat('b',64),'虚构人民币结算说明',$3,$4,'Fixture account','CAD',235000,$5,'2026-11-04') returning id",[wallet,orgA,admin,accountA,quote])).rows[0].id;
  await db.query("insert into public.monthly_ad_report_lines(report_id,campaign,market,source_cad_minor,spend_minor) values($1,'Fixture CAD cost','Canada',235000,1222000)",[report]);
 });
 it("does not publish with an outdated quote date or a quote captured after confirmation",async()=>{
  await expect(db.query('update public.monthly_ad_reports set settlement_date=$2,published_at=$3 where id=$1',[report,'2026-11-03',confirmTime])).rejects.toThrow(/quote/i);
  await expect(db.query('update public.monthly_ad_reports set published_at=$2 where id=$1',[report,'2026-11-04T01:00:00Z'])).rejects.toThrow(/precede confirmation/);
 });
 it("does not accept a hidden ten percent charge without a fee agreement",async()=>{
  await expect(db.query('update public.monthly_ad_reports set service_fee_minor=122200,published_at=$2 where id=$1',[report,confirmTime])).rejects.toThrow(/fee mismatch/);
  await expect(db.query('update public.monthly_ad_reports set fee_basis_points=1000,service_fee_minor=122200,published_at=$2 where id=$1',[report,confirmTime])).rejects.toThrow(/Agreed fee evidence/);
 });
 it("publishes an exact CNY conversion with zero default fee and keeps its quote immutable",async()=>{
  await db.query('update public.monthly_ad_reports set published_at=$2 where id=$1',[report,confirmTime]);
  const result=await asUser<{ad_spend_minor:number;service_fee_minor:number;fee_basis_points:number}>(alice,'aal1','select ad_spend_minor,service_fee_minor,fee_basis_points from public.monthly_ad_reports where id=$1',[report]);expect(result.rows).toEqual([{ad_spend_minor:1222000,service_fee_minor:0,fee_basis_points:0}]);
  await expect(db.query("update public.billing_fx_quotes set cad_cny_rate='6.0' where id=$1",[quote])).rejects.toThrow(/immutable/);
  expect((await asUser(bob,'aal1','select * from public.billing_fx_quotes')).rows).toEqual([]);
  expect((await asUser(alice,'aal1','select id from public.billing_fx_quotes where id=$1',[quote])).rows).toEqual([{id:quote}]);
 });
 it("requires a new revision for adjustments and rejects using a demo rate in a final bill",async()=>{
  await expect(db.query('update public.monthly_ad_reports set service_fee_minor=1 where id=$1',[report])).rejects.toThrow(/immutable/);
  const fake=(await db.query<{id:string}>("insert into public.billing_fx_quotes(cad_cny_rate,value_date,quoted_at,source_name,is_demo) values('5.2','2026-11-04','2026-11-04T02:00:00Z','Fictional rate',true) returning id")).rows[0].id;
  const revision=(await db.query<{id:string}>("insert into public.monthly_ad_reports(wallet_id,organization_id,currency,month,version,ad_spend_minor,service_fee_minor,source_language,translation_status,source_filename,source_timezone,source_storage_key,source_sha256,summary_zh,reviewed_by,ad_account_id,source_account_name,source_currency,source_ad_spend_minor,fx_quote_id,settlement_date) values($1,$2,'CNY','2026-10-01',2,1222000,0,'en','reviewed','fixture-CAD.csv','America/Toronto','private/fixture-CAD.csv',repeat('b',64),'示例不应发布',$3,$4,'Fixture account','CAD',235000,$5,'2026-11-04') returning id",[wallet,orgA,admin,accountA,fake])).rows[0].id;
  await db.query("insert into public.monthly_ad_report_lines(report_id,campaign,market,source_cad_minor,spend_minor) values($1,'Fixture CAD cost','Canada',235000,1222000)",[revision]);
  await expect(db.query('update public.monthly_ad_reports set published_at=$2 where id=$1',[revision,confirmTime])).rejects.toThrow(/demo rates/);
 });
});
describe("Manual CRM, explicit phone invitations and contract records",()=>{
 let crmOrg:string;let contact:string;let invitation:string;let contract:string;
 it("lets business staff manually create a client and contact without creating a login",async()=>{
  crmOrg=(await asUser<{id:string}>(operator,'aal2',"select public.save_crm_client(null,'Manual fixture','Manual fixture legal','','CN','https://example.com','Manufacturing','onboarding','Private internal fixture',0) as id")).rows[0].id;
  contact=(await asUser<{id:string}>(operator,'aal2',"select public.save_crm_contact($1,null,'Fixture representative','Finance','+8613800138000','','finance') as id",[crmOrg])).rows[0].id;
  expect((await db.query<{count:number}>('select count(*)::integer as count from auth.users')).rows[0].count).toBe(5);
  expect((await asUser(alice,'aal1','select id from public.organizations where id=$1',[crmOrg])).rows).toEqual([]);
  await expect(asUser(operator,'aal2',"select public.save_crm_client($1,'Stale','Stale legal','','CN','','','active','',99)",[crmOrg])).rejects.toThrow(/Stale/);
 });
 it("requires administrator MFA and explicit company authorization to invite",async()=>{
  for(const [id,aal] of [[operator,'aal2'],[admin,'aal1'],[alice,'aal2']] as const)await expect(asUser(id,aal,"select public.invite_crm_contact($1,$2,'viewer','manager','verified-business-reference')",[crmOrg,contact])).rejects.toThrow(/Forbidden/);
  invitation=(await asUser<{id:string}>(admin,'aal2',"select public.invite_crm_contact($1,$2,'viewer','manager','verified-business-reference') as id",[crmOrg,contact])).rows[0].id;
  expect((await asUser<{count:number}>(alice,'aal1','select public.claim_crm_invites() as count')).rows[0].count).toBe(0);
 });
 it("claims only a preapproved invitation after provider-verified phone login, idempotently",async()=>{
  await db.query("update auth.users set phone='8613800138000',phone_confirmed_at=now() where id=$1",[alice]);
  expect((await asUser<{count:number}>(bob,'aal1','select public.claim_crm_invites() as count')).rows[0].count).toBe(0);
  expect((await asUser<{count:number}>(alice,'aal1','select public.claim_crm_invites() as count')).rows[0].count).toBe(1);
  expect((await asUser<{count:number}>(alice,'aal1','select public.claim_crm_invites() as count')).rows[0].count).toBe(0);
  expect((await asUser<{role:string}>(alice,'aal1','select role from public.finance_access where organization_id=$1',[crmOrg])).rows).toEqual([{role:'manager'}]);
  const own=await asUser<{id:string;legal_name:string}>(alice,'aal1','select id,legal_name from public.get_my_company_profiles() where id=$1',[crmOrg]);expect(own.rows).toEqual([{id:crmOrg,legal_name:'Manual fixture legal'}]);
  expect((await asUser(alice,'aal1','select * from public.client_profiles')).rows).toEqual([]);
  expect((await asUser(alice,'aal1','select * from public.customer_invites')).rows).toEqual([]);
 });
 it("opens a zero-value CNY wallet and limits staff finance reads to administrators",async()=>{
  await asUser(admin,'aal2','select public.open_crm_wallet($1)',[crmOrg]);
  await expect(asUser(operator,'aal2','select public.get_crm_finance_summary($1)',[crmOrg])).rejects.toThrow(/Forbidden/);
  const summary=await asUser<{data:{currency:string;balance_minor:string}[]}>(admin,'aal2','select public.get_crm_finance_summary($1) as data',[crmOrg]);expect(summary.rows[0].data[0]).toEqual(expect.objectContaining({currency:'CNY',balance_minor:'0'}));
 });
 it("keeps contract drafts private, snapshots party names and does not claim e-signature verification",async()=>{
  contract=(await asUser<{id:string}>(admin,'aal2',"select public.create_crm_contract($1,'Fixture agreement','Fixture provider legal','A full fictional service scope','CNY charges only under an agreed quotation','Unused funds reconciled before any approved refund','2026-01-01','2027-12-31','Draft template snapshot for testing only') as id",[crmOrg])).rows[0].id;
  expect((await asUser(alice,'aal1','select id from public.client_contracts where id=$1',[contract])).rows).toEqual([]);
  expect((await asUser(operator,'aal2','select id from public.client_contracts where id=$1',[contract])).rows).toEqual([]);
  await expect(asUser(admin,'aal2',"select public.update_crm_contract($1,'signed',true,'external-doc','2026-11-01','draft')",[contract])).rejects.toThrow(/Invalid contract transition/);
  await asUser(admin,'aal2',"select public.update_crm_contract($1,'sent',true,'',null,'draft')",[contract]);
  expect((await asUser(alice,'aal1','select id from public.client_contracts where id=$1',[contract])).rows).toEqual([{id:contract}]);
  expect((await asUser(bob,'aal1','select id from public.client_contracts where id=$1',[contract])).rows).toEqual([]);
  await expect(asUser(alice,'aal1','select created_by from public.client_contracts')).rejects.toThrow(/permission denied/);
  await expect(db.query("update public.client_contracts set pricing_terms='Changed after issue' where id=$1",[contract])).rejects.toThrow(/immutable/);
 });
 it("requires signature evidence and preserves it after recording",async()=>{
  await expect(asUser(admin,'aal2',"select public.update_crm_contract($1,'signed',true,'',null,'sent')",[contract])).rejects.toThrow(/signature evidence/);
  await asUser(admin,'aal2',"select public.update_crm_contract($1,'signed',true,'external-signed-fixture','2026-11-01','sent')",[contract]);
  await expect(db.query("update public.client_contracts set signature_reference='replaced' where id=$1",[contract])).rejects.toThrow(/immutable/);
 });
 it("downgrades finance independently and revokes pending invitations before they can restore access",async()=>{
  await asUser(admin,'aal2',"select public.invite_crm_contact($1,$2,'viewer','manager','fresh-company-authorization')",[crmOrg,contact]);
  await asUser(admin,'aal2',"select public.set_crm_finance_access($1,$2,'none')",[crmOrg,alice]);
  expect((await asUser<{count:number}>(alice,'aal1','select public.claim_crm_invites() as count')).rows[0].count).toBe(0);
  expect((await asUser(alice,'aal1','select id from public.client_contracts where id=$1',[contract])).rows).toEqual([]);
  expect((await asUser(alice,'aal1','select id from public.organizations where id=$1',[crmOrg])).rows).toEqual([{id:crmOrg}]);
  await asUser(admin,'aal2','select public.revoke_crm_access($1,$2,null)',[crmOrg,alice]);
  expect((await asUser(alice,'aal1','select id from public.organizations where id=$1',[crmOrg])).rows).toEqual([]);
 });
 it("does not copy contact phones or internal notes into the audit trail",async()=>{
  const result=await db.query<{changes:unknown}>("select changes from public.audit_events where entity_id in ($1,$2,$3)",[crmOrg,contact,invitation]);
  expect(JSON.stringify(result.rows)).not.toContain('13800138000');expect(JSON.stringify(result.rows)).not.toContain('Private internal fixture');
 });
});
describe("CRM invitation expiry and identity safeguards",()=>{
 let org:string;let contact:string;
 it("does not authorize an unconfirmed phone, an expired invitation or an invitation from an inactive administrator",async()=>{
  org=(await asUser<{id:string}>(admin,'aal2',"select public.save_crm_client(null,'Expiry fixture','Expiry legal','','CN','','','onboarding','',0) as id")).rows[0].id;
  contact=(await asUser<{id:string}>(admin,'aal2',"select public.save_crm_contact($1,null,'Expiry representative','','+8613900139000','','business') as id",[org])).rows[0].id;
  await db.query("update auth.users set phone='8613900139000',phone_confirmed_at=null where id=$1",[bob]);
  await asUser(admin,'aal2',"select public.invite_crm_contact($1,$2,'viewer','viewer','authorized-contact-fixture')",[org,contact]);
  expect((await asUser<{n:number}>(bob,'aal1','select public.claim_crm_invites() as n')).rows[0].n).toBe(0);
  await db.query('update auth.users set phone_confirmed_at=now() where id=$1',[bob]);
  await db.query("update public.customer_invites set expires_at=now()-interval '1 second' where organization_id=$1",[org]);
  expect((await asUser<{n:number}>(bob,'aal1','select public.claim_crm_invites() as n')).rows[0].n).toBe(0);
  await asUser(admin,'aal2',"select public.invite_crm_contact($1,$2,'viewer','viewer','new-authorization-fixture')",[org,contact]);
  await db.query('update public.staff_members set active=false where user_id=$1',[admin]);
  expect((await asUser<{n:number}>(bob,'aal1','select public.claim_crm_invites() as n')).rows[0].n).toBe(0);
  await db.query('update public.staff_members set active=true where user_id=$1',[admin]);
 });
 it("invalidates outstanding authorizations when the company is archived",async()=>{
  await asUser(admin,'aal2',"select public.save_crm_client($1,'Expiry fixture','Expiry legal','','CN','','','closed','',1)",[org]);
  expect((await asUser<{n:number}>(bob,'aal1','select public.claim_crm_invites() as n')).rows[0].n).toBe(0);
  await expect(asUser(admin,'aal2',"select public.invite_crm_contact($1,$2,'viewer','viewer','should-not-create')",[org,contact])).rejects.toThrow(/open client profile/);
 });
});
