import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {resolveConfig} from '../scripts/check-supabase-connection.mjs';
// Generated operational artifact is validated by executing real PostgreSQL SQL, not string matching alone.
const bundleUrl=new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url);
let db:PGlite;let sql:string;
async function prepare(db:PGlite){await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);}
beforeAll(async()=>{sql=await readFile(bundleUrl,'utf8');db=new PGlite();await prepare(db);},30000);
afterAll(async()=>{await db?.close();});
it('keeps the distributable bundle synchronized with source migrations',()=>{const result=spawnSync(process.execPath,['scripts/prepare-supabase-bootstrap.mjs','--check'],{encoding:'utf8'});expect(result.status).toBe(0);});
it('initializes the full empty Supabase schema without users or business data',async()=>{
 await db.exec(sql);
 for(const table of ['organizations','staff_members','customer_applications','bank_receipts','ops_reconciliations'])expect((await db.query(`select * from public.${table}`)).rows).toEqual([]);
 expect((await db.query('select * from auth.users')).rows).toEqual([]);
 const flags=await db.query<{relrowsecurity:boolean}>("select relrowsecurity from pg_class where oid='public.customer_applications'::regclass");expect(flags.rows[0].relrowsecurity).toBe(true);
 await expect(db.transaction(async tx=>{await tx.exec('set local role authenticated');expect((await tx.query('select id from public.customer_applications')).rows).toEqual([]);await tx.exec("insert into public.organizations(name) values('Untrusted client company')");})).rejects.toThrow();
});
it('stops a second initialization without replacing prior data',async()=>{
 const user='11111111-aaaa-4111-8111-111111111111';await db.query('insert into auth.users(id) values($1)',[user]);
 await expect(db.exec(sql)).rejects.toThrow(/Existing application objects/);await db.exec('rollback');
 expect((await db.query('select id from auth.users')).rows).toEqual([{id:user}]);
});
it('rolls back the whole bootstrap if a late statement fails',async()=>{
 const isolated=new PGlite();try{await prepare(isolated);const broken=sql.replace("notify pgrst, 'reload schema';","select missing_bootstrap_function();");await expect(isolated.exec(broken)).rejects.toThrow();await isolated.exec('rollback');expect((await isolated.query<{name:string|null}>("select to_regclass('public.organizations')::text as name")).rows[0].name).toBeNull();expect((await isolated.query("select to_regclass('auth.users')::text as name")).rows[0]).toEqual({name:'auth.users'});}finally{await isolated.close();}
},30000);
it('rejects malformed environment assignment values without printing keys or making requests',()=>{
 const value='sb_publishable_TEST_ONLY_NEVER_NETWORK';
 expect(()=>resolveConfig({SUPABASE_URL:'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:value})).toThrow(/without NAME=/);
 const logs:string[]=[];const resolved=resolveConfig({SUPABASE_URL:'NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='+value},true,(line:string)=>logs.push(line));
 expect(resolved.origin).toBe('https://example.supabase.co');expect(logs.join('')).not.toContain(value);expect(logs).toHaveLength(2);
});
