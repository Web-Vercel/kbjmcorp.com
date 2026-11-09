import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/020_ads_readonly_reporting.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/022_ads_calendar_month.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into auth.users(id) values('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin'),('a0000000-0000-4000-8000-000000000002','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('a0000000-0000-4000-8000-000000000002','zhidian_cn','finance_reviewer');insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','FICTIONAL PRICING COMPANY');`);
},30000);
afterAll(async()=>{await db?.close();});


const report={version:'ads-readonly-v1',account:{id:'adacct_fictional',name:'FICTIONAL ACCOUNT',currency_code:'CAD',timezone:'UTC'},since:'2026-10-25',until:'2026-10-31',check:'matched',dailySpendMicros:'18420001',periodSpendMicros:'18420001',rawSha256:'a'.repeat(64),daily:[],rawResponses:[{path:'/ad_account',body:'FICTIONAL PRIVATE SOURCE'}]};
async function asUser(who:string,sql:string,args:unknown[]=[],aal='aal2'){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${who}',true);select set_config('request.jwt.claims','{"aal":"${aal}"}',true);`);try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
const save=(who='1',value=report,aal='aal2')=>asUser(who,'select public.save_ads_reporting_snapshot($1,$2) id',['c0000000-0000-4000-8000-000000000001',JSON.stringify(value)],aal);
it('stores an immutable exact-decimal source once, audits it and never posts money',async()=>{const first=await save();expect((await save()).rows).toEqual(first.rows);expect((await db.query('select daily_spend_micros::text amount from public.ads_reporting_snapshots')).rows).toEqual([{amount:'18420001'}]);expect((await db.query("select count(*)::int n from public.audit_events where entity_type='ads_readonly_snapshot'")).rows).toEqual([{n:1}]);expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);await expect(save('1',{...report,dailySpendMicros:'1'})).rejects.toThrow(/Request changed/);await expect(db.exec('delete from public.ads_reporting_snapshots')).rejects.toThrow(/immutable/);});
it('isolates raw real-account sources from finance, clients and sessions without MFA',async()=>{await save();for(const who of ['2','3']){expect((await asUser(who,'select * from public.ads_reporting_snapshots')).rows).toEqual([]);await expect(save(who)).rejects.toThrow(/Forbidden/);}expect((await asUser('1','select * from public.ads_reporting_snapshots',[],'aal1')).rows).toEqual([]);await expect(save('1',report,'aal1')).rejects.toThrow(/Forbidden/);expect((await asUser('1','select count(*)::int n from public.ads_reporting_snapshots')).rows).toEqual([{n:1}]);});

it('accepts full calendar months while rejecting partial-month windows',async()=>{
 const savePeriod=(request:string,since:string,until:string)=>asUser('1','select public.save_ads_reporting_snapshot($1,$2) id',[request,JSON.stringify({...report,since,until})]);
 await expect(savePeriod('c0000000-0000-4000-8000-000000000002','2024-02-01','2024-02-29')).resolves.toBeDefined();
 await expect(savePeriod('c0000000-0000-4000-8000-000000000003','2026-10-01','2026-10-31')).resolves.toBeDefined();
 await expect(savePeriod('c0000000-0000-4000-8000-000000000004','2026-10-01','2026-10-15')).rejects.toThrow(/constraint/);
});

it('migration 023 permits bounded operational windows without relaxing immutability or exposing sources',async()=>{
 await db.exec(await readFile(new URL('../supabase/migrations/023_ads_operational_periods.sql',import.meta.url),'utf8'));
 const saveRange=(request:string,since:string,until:string)=>asUser('1','select public.save_ads_reporting_snapshot($1,$2) id',[request,JSON.stringify({...report,since,until})]);
 await expect(saveRange('c0000000-0000-4000-8000-000000000005','2026-10-01','2026-10-15')).resolves.toBeDefined();
 await expect(saveRange('c0000000-0000-4000-8000-000000000006','2026-10-01','2026-11-01')).rejects.toThrow(/constraint/);
 await expect(saveRange('c0000000-0000-4000-8000-000000000007','2026-10-03','2026-10-01')).rejects.toThrow(/constraint/);
 expect((await asUser('2','select * from public.ads_reporting_snapshots')).rows).toEqual([]);
 await expect(db.exec('delete from public.ads_reporting_snapshots')).rejects.toThrow(/immutable/);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);
});
