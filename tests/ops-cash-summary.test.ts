import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;let probe:string;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/014_ops_cash_summary.sql',import.meta.url),'utf8'));
 probe=await readFile(new URL('../supabase/tests/bank-receipt-acceptance.sql',import.meta.url),'utf8');
},30000);
afterAll(async()=>{await db?.close();});
it('distinguishes zero customer notices, pending receipts and exact posted funds in authorized snapshots',async()=>{
 const pending=`perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000003',true);perform set_config('request.jwt.claims','{"aal":"aal2"}',true);
 if (public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')->0->>'pending_notice_count')<>'0' or (public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')->0->>'pending_receipt_minor')<>'100001' then raise exception 'FAIL pending snapshot';end if;`;
 const posted=`if (public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')->0->>'balance_minor')<>'100001' or (public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')->0->>'pending_receipt_count')<>'0' or jsonb_array_length(public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')->0->'recent_entries')<>1 then raise exception 'FAIL posted snapshot';end if;`;
 const ownProbe=probe.replace(" begin perform public.review_bank_receipt(receipt,'credited','Self review must fail');",pending+" begin perform public.review_bank_receipt(receipt,'credited','Self review must fail');");
 // Restore preparer's claims after checking the reviewer snapshot, so self-review remains meaningful.
 const restore="perform set_config('request.jwt.claim.sub','e5900000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{\"aal\":\"aal2\"}',true);";
 const finalProbe=ownProbe.replace(" begin perform public.review_bank_receipt(receipt,'credited','Self review must fail');",restore+" begin perform public.review_bank_receipt(receipt,'credited','Self review must fail');").replace(" perform public.review_bank_receipt(receipt,'credited','Retry must not credit twice');",posted+" perform public.review_bank_receipt(receipt,'credited','Retry must not credit twice');");
 expect((await db.exec(finalProbe)).some(r=>r.rows.some(row=>(row as {receipt_acceptance?:string}).receipt_acceptance==='PASS'))).toBe(true);
},30000);
it('denies customer and unauthenticated cash summaries',async()=>{
 await db.exec("begin;set local role authenticated;select set_config('request.jwt.claims','{}',true)");
 await expect(db.exec("select public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')")).rejects.toThrow(/Forbidden/);await db.exec('rollback');
 await db.exec('begin;set local role anon');await expect(db.exec("select public.get_ops_cash_summary('e5900000-0000-4000-8000-000000000101')")).rejects.toThrow(/permission denied/);await db.exec('rollback');
});
