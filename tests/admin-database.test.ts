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
 create schema auth;create table auth.users(id uuid primary key);
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
