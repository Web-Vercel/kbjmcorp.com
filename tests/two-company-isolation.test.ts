import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;let probe:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 probe=await readFile(new URL('../supabase/tests/two-company-isolation.sql',import.meta.url),'utf8');
},30000);
afterAll(async()=>{await db?.close();});
it('executes the standalone two-company RLS acceptance and leaves no fixture data behind',async()=>{
 const result=await db.exec(probe);
 expect(result.some(r=>r.rows.some(row=>(row as {isolation_result?:string}).isolation_result==='PASS'))).toBe(true);
 expect((await db.query('select count(*)::integer as n from public.organizations')).rows).toEqual([{n:0}]);
 expect((await db.query('select count(*)::integer as n from auth.users')).rows).toEqual([{n:0}]);
 expect((await db.query('select count(*)::integer as n from public.wallet_entries')).rows).toEqual([{n:0}]);
},30000);
it('fails on a real RLS regression instead of returning a false pass',async()=>{
 await db.exec('create policy deliberate_test_leak on public.organizations for select to authenticated using(true);');
 try{await expect(db.exec(probe)).rejects.toThrow(/company list leaks/);await db.exec('rollback');expect((await db.query('select count(*)::integer as n from public.organizations')).rows).toEqual([{n:0}]);}finally{await db.exec('drop policy deliberate_test_leak on public.organizations;');}
},30000);
it('refuses to overwrite pre-existing fixture identifiers',async()=>{
 await db.exec("insert into auth.users(id) values('e5700000-0000-4000-8000-000000000001');");
 await expect(db.exec(probe)).rejects.toThrow(/Reserved fixture identifiers/);await db.exec('rollback');expect((await db.query('select count(*)::integer as n from auth.users')).rows).toEqual([{n:1}]);
 await db.exec("delete from auth.users where id='e5700000-0000-4000-8000-000000000001';");
});
