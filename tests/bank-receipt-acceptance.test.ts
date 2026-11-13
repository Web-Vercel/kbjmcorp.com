import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;let probe:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 probe=await readFile(new URL('../supabase/tests/bank-receipt-acceptance.sql',import.meta.url),'utf8');
},30000);
afterAll(async()=>{await db?.close();});
it('validates dual approval, exact minor units, deduplication and rollback without persistent money',async()=>{
 const results=await db.exec(probe);
 expect(results.some(r=>r.rows.some(row=>(row as {receipt_acceptance?:string}).receipt_acceptance==='PASS'))).toBe(true);
 expect(results.at(-1)?.rows).toEqual([{fixture_users:0,fixture_companies:0}]);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);
},30000);
it('detects client-visible internal bank evidence',async()=>{
 await db.exec('create policy deliberate_bank_leak on public.bank_receipts for select to authenticated using(true)');
 try {await expect(db.exec(probe)).rejects.toThrow(/internal bank evidence/);await db.exec('rollback');}
 finally {await db.exec('drop policy deliberate_bank_leak on public.bank_receipts');}
},30000);
it('refuses existing reserved identifiers',async()=>{
 await db.exec("insert into auth.users(id) values('e5900000-0000-4000-8000-000000000001')");
 await expect(db.exec(probe)).rejects.toThrow(/Reserved fixture/);await db.exec('rollback');
},30000);
