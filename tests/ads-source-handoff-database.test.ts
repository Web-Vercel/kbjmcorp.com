import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/020_ads_readonly_reporting.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/021_ads_source_handoff.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001');insert into auth.users(id) values('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin'),('a0000000-0000-4000-8000-000000000002','operator');insert into public.staff_unit_roles(user_id,unit_code,role) values('a0000000-0000-4000-8000-000000000002','zhidian_cn','finance_reviewer');insert into public.organizations(id,name) values('b0000000-0000-4000-8000-000000000001','FICTIONAL PRICING COMPANY');`);
},30000);
afterAll(async()=>{await db?.close();});


const orgA='b0000000-0000-4000-8000-000000000001',orgB='b0000000-0000-4000-8000-000000000002';
const report={version:'ads-readonly-v1',account:{id:'adacct_fictional',name:'FICTIONAL ACCOUNT',currency_code:'CAD',timezone:'UTC'},since:'2026-10-25',until:'2026-10-31',check:'no_data',missingDates:['2026-10-31'],endBoundary:'last_day_label_unverified',dailySpendMicros:'18420001',periodSpendMicros:'18420001',rawSha256:'a'.repeat(64),daily:[{date:'2026-10-25',spendMicros:'18420001',impressions:'1000',clicks:'30',privateMemo:'PRIVATE ROW FIELD'}],rawResponses:[{path:'/ad_account',body:'PRIVATE RAW RESPONSE'}]};
async function asUser(who:string,sql:string,args:unknown[]=[],aal='aal2'){await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${who}',true);select set_config('request.jwt.claims','{"aal":"${aal}"}',true);`);try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}}
async function fixture(){
 await db.exec(`insert into public.organizations(id,name) values('${orgB}','OTHER FICTIONAL COMPANY') on conflict do nothing;insert into public.memberships(organization_id,user_id,role) values('${orgA}','a0000000-0000-4000-8000-000000000003','viewer') on conflict do nothing`);
 await db.exec(`insert into public.finance_access(organization_id,user_id,role) values('${orgA}','a0000000-0000-4000-8000-000000000003','viewer') on conflict do nothing`);
 const first=String((await asUser('1',"select public.save_ads_reporting_snapshot('c0000000-0000-4000-8000-000000000001',$1) id",[JSON.stringify(report)])).rows[0].id);
 const second=String((await asUser('1',"select public.save_ads_reporting_snapshot('c0000000-0000-4000-8000-000000000002',$1) id",[JSON.stringify(report)])).rows[0].id);
 const other=String((await asUser('1',"select public.save_ads_reporting_snapshot('c0000000-0000-4000-8000-000000000003',$1) id",[JSON.stringify({...report,account:{...report.account,id:'adacct_other'}})])).rows[0].id);
 return {first,second,other};
}
it('freezes explicit ownership and hands off exactly one selected source with a restricted projection',async()=>{
 const {first,second,other}=await fixture();const bind=()=>asUser('1',"select public.bind_ads_reporting_account($1,$2,'PRIVATE ownership evidence') id",[first,orgA]);const binding=String((await bind()).rows[0].id);expect((await bind()).rows[0].id).toBe(binding);
 await expect(asUser('1',"select public.bind_ads_reporting_account($1,$2,'Wrong company')",[first,orgB])).rejects.toThrow(/already linked/);
 const share=()=>asUser('1',"select public.share_ads_source_snapshot($1,$2,'Compared against source; boundary pending') id",[first,binding]);const id=(await share()).rows[0].id;expect((await share()).rows[0].id).toBe(id);
 await expect(asUser('1',"select public.share_ads_source_snapshot($1,$2,'Wrong account source')",[other,binding])).rejects.toThrow(/mismatch/);
 await expect(asUser('1',"select public.share_ads_source_snapshot($1,$2,'Changed evidence')",[first,binding])).rejects.toThrow(/frozen/);
 const rows=(await asUser('2','select public.list_ads_source_handoffs($1) records',[orgA])).rows[0].records as Record<string,unknown>[];
 expect(rows).toHaveLength(1);expect(rows[0].snapshot_id).toBe(first);expect(rows[0].source_check).toBe('no_data');expect(rows[0].missing_dates).toEqual(['2026-10-31']);expect(rows[0].daily_spend_micros).toBe('18420001');expect(rows[0].daily).toEqual([{date:'2026-10-25',spend_micros:'18420001',impressions:'1000',clicks:'30'}]);expect(JSON.stringify(rows)).not.toContain('PRIVATE');expect(JSON.stringify(rows)).not.toContain(second);
 expect((await asUser('2','select public.list_ads_source_handoffs($1) records',[orgB])).rows[0].records).toEqual([]);
 for(const table of ['ads_reporting_snapshots','ads_reporting_bindings','ads_source_handoffs'])expect((await asUser('2',`select * from public.${table}`)).rows).toEqual([]);
 await expect(asUser('3','select public.list_ads_source_handoffs($1)',[orgA])).rejects.toThrow(/Forbidden/);
 await expect(asUser('2',"select public.bind_ads_reporting_account($1,$2,'unauthorized evidence')",[first,orgA])).rejects.toThrow(/Forbidden/);
 await expect(asUser('1',"select public.share_ads_source_snapshot($1,$2,'MFA missing')",[second,binding],'aal1')).rejects.toThrow(/Forbidden/);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);expect((await db.query('select count(*)::int n from public.monthly_ad_reports')).rows).toEqual([{n:0}]);
});
it('pauses future reads immediately, rejects stale changes, restores access and retains immutable history',async()=>{
 const {first,second}=await fixture();const binding=String((await asUser('1',"select public.bind_ads_reporting_account($1,$2,'PRIVATE ownership evidence') id",[first,orgA])).rows[0].id);
 expect((await asUser('1',"select public.set_ads_binding_active($1,false,1,'Pause for review') revision",[binding])).rows).toEqual([{revision:2}]);
 expect((await asUser('2','select public.list_ads_source_handoffs($1) records',[orgA])).rows[0].records).toEqual([]);
 await expect(asUser('1',"select public.share_ads_source_snapshot($1,$2,'Access paused')",[second,binding])).rejects.toThrow(/inactive/);
 await expect(asUser('1',"select public.set_ads_binding_active($1,true,1,'Stale restore')",[binding])).rejects.toThrow(/State changed/);
 await asUser('1',"select public.set_ads_binding_active($1,true,2,'Restore checked access')",[binding]);
 expect(((await asUser('2','select public.list_ads_source_handoffs($1) records',[orgA])).rows[0].records as unknown[])).toHaveLength(1);
 await expect(db.exec(`update public.ads_reporting_bindings set organization_id='${orgB}'`)).rejects.toThrow(/immutable/);await expect(db.exec('delete from public.ads_source_handoffs')).rejects.toThrow(/immutable/);await expect(db.exec('delete from public.ads_reporting_bindings')).rejects.toThrow(/immutable/);
 await db.exec("update public.staff_unit_roles set active=false where user_id='a0000000-0000-4000-8000-000000000002'");await expect(asUser('2','select public.list_ads_source_handoffs($1)',[orgA])).rejects.toThrow(/Forbidden/);
 expect((await db.query("select count(*)::int n from public.audit_events where entity_type='ads_source_handoff'")).rows).toEqual([{n:1}]);
});
it('rejects an advertiser identity already owned by a different company in the existing account registry',async()=>{
 const {other}=await fixture();await db.exec(`insert into public.ad_accounts(organization_id,platform,external_id,label) values('${orgB}','openai_ads','adacct_other','OTHER FICTIONAL ACCOUNT')`);
 await expect(asUser('1',"select public.bind_ads_reporting_account($1,$2,'Wrong ownership reference')",[other,orgA])).rejects.toThrow(/already linked/);
 expect((await db.query("select count(*)::int n from public.ads_reporting_bindings where account_id='adacct_other'")).rows).toEqual([{n:0}]);
 await expect(asUser('1','select public.list_ads_source_handoffs($1)',[orgA],'aal1')).rejects.toThrow(/Forbidden/);
});
