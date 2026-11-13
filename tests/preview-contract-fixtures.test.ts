import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterEach,beforeEach,expect,it} from 'vitest';
let db:PGlite;let probe:string;let cleanup:string;
beforeEach(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 probe=await readFile(new URL('../supabase/tests/preview-contract-fixtures.sql',import.meta.url),'utf8');
 cleanup=await readFile(new URL('../supabase/tests/cleanup-preview-contract-fixtures.sql',import.meta.url),'utf8');
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');
 insert into public.staff_members(user_id,role,active) values('a0000000-0000-4000-8000-000000000003','admin',true);
 insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','测试企业A'),('b0000000-0000-4000-8000-000000000002','测试企业B');
 insert into public.memberships(organization_id,user_id,role) values('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','viewer'),('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','viewer');
 insert into public.finance_access select organization_id,user_id,'viewer' from public.memberships;`);
},30000);
afterEach(async()=>{await db?.close();});

it('creates fictional documents, denies cross-company reads, refuses duplicates and cleans only fixtures',async()=>{
 await db.exec(probe);
 await expect(db.exec(probe)).rejects.toThrow(/already exists/);await db.exec('rollback');
 for(const suffix of ['1','2']){
  await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${suffix}',true);`);
  const rows=(await db.query('select title from public.client_contracts')).rows;
  expect(rows).toEqual([{title:'【虚构验收合同】测试企业'+(suffix==='1'?'A':'B')}]);
  await db.exec('rollback');
 }
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);
 await db.exec("update public.client_contracts set signature_reference='CHANGED-TEST' where id='e5800000-0000-4000-8000-000000000601'");
 await expect(db.exec(cleanup)).rejects.toThrow(/Fixture changed/);await db.exec('rollback');
 expect((await db.query('select count(*)::int n from public.client_contracts')).rows).toEqual([{n:2}]);
 await db.exec("update public.client_contracts set signature_reference=null where id='e5800000-0000-4000-8000-000000000601'");
 await db.exec(cleanup);
 expect((await db.query('select count(*)::int n from public.client_contracts where client_visible')).rows).toEqual([{n:0}]);
 expect((await db.query('select count(*)::int n from public.audit_events where entity_type=\'preview_contract_fixture\'')).rows).toEqual([{n:4}]);
},30000);
it('refuses ambiguous company names without leaving partial fixtures',async()=>{
 await db.exec("insert into public.organizations(name) values('测试企业B')");
 await expect(db.exec(probe)).rejects.toThrow(/exactly one test company/);await db.exec('rollback');
 expect((await db.query('select count(*)::int n from public.client_contracts where client_visible')).rows).toEqual([{n:0}]);
},30000);
