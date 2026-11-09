import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const org='b0000000-0000-4000-8000-000000000001',other='b0000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 for(const name of ['018_agency_quote_snapshots','019_quote_revision_archive','020_ads_readonly_reporting','021_ads_source_handoff','023_ads_operational_periods','024_monthly_settlement_review'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users(id) select ('a0000000-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,4)n;
 insert into public.staff_members(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin'),('a0000000-0000-4000-8000-000000000002','operator'),('a0000000-0000-4000-8000-000000000003','operator');
 insert into public.staff_unit_roles(user_id,unit_code,role) values('a0000000-0000-4000-8000-000000000002','zhidian_cn','finance_preparer'),('a0000000-0000-4000-8000-000000000003','zhidian_cn','finance_reviewer');
 insert into public.organizations(id,name) values('${org}','FICTIONAL SETTLEMENT COMPANY'),('${other}','OTHER FICTIONAL COMPANY');`);
},30000);
afterAll(async()=>{await db?.close();});
async function asUser(who:string,sql:string,args:unknown[]=[],aal='aal2'){
 await db.exec(`begin;set local role authenticated;select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000${who}',true);select set_config('request.jwt.claims','{"aal":"${aal}"}',true);`);
 try{const r=await db.query<Record<string,unknown>>(sql,args);await db.exec('commit');return r;}catch(e){await db.exec('rollback');throw e;}
}
const daily=Array.from({length:31},(_,i)=>({date:`2024-01-${String(i+1).padStart(2,'0')}`,spendMicros:i===0?'100005000':'0',impressions:'1',clicks:'0'}));
async function fixture(patch:Record<string,unknown>={},quotePatch:Record<string,unknown>={},quoteOrg=org,share=true){
 const report={version:'ads-readonly-v1',account:{id:'adacct_fictional_'+randomUUID(),name:'FICTIONAL ACCOUNT',currency_code:'CAD',timezone:'UTC'},since:'2024-01-01',until:'2024-01-31',check:'matched',missingDates:[],endBoundary:'exclusive',dailySpendMicros:'100005000',periodSpendMicros:'100005000',rawSha256:'a'.repeat(64),daily,rawResponses:[{path:'/ad_account',body:'PRIVATE RAW SOURCE'}],...patch};
 const snapshot=String((await asUser('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).rows[0].id);
 const binding=String((await asUser('1',"select public.bind_ads_reporting_account($1,$2,'PRIVATE OWNERSHIP EVIDENCE') id",[snapshot,org])).rows[0].id);
 if(share)await asUser('1',"select public.share_ads_source_snapshot($1,$2,'Internal source for review')",[snapshot,binding]);
 const quote=String((await asUser('1','select public.save_agency_quote_snapshot($1,$2,$3,$4,$5) id',[quoteOrg,'2024-01-01',randomUUID(),'b'.repeat(64),JSON.stringify({status:'draft',calculationVersion:'two-agency-v1',sourceCadMinor:'10001',finalMinor:'12345',rate:'PRIVATE_FX',...quotePatch})])).rows[0].id);
 return {snapshot,binding,quote};
}
const prepare=(f:{snapshot:string;quote:string},who='2',note='Verified monthly preparation')=>asUser(who,"select public.prepare_monthly_settlement($1,$2,'FEE-AGREEMENT-EXAMPLE',$3) id",[f.snapshot,f.quote,note]);
it('creates an exact source-linked draft once, enforces independent review and never posts money',async()=>{
 const f=await fixture();const first=await prepare(f,'1');const id=String(first.rows[0].id);expect((await prepare(f,'1')).rows).toEqual(first.rows);
 await expect(prepare(f,'1','Changed note')).rejects.toThrow(/already exists/);
 await expect(asUser('1',"select public.review_monthly_settlement($1,'approved','Self review is forbidden')",[id])).rejects.toThrow(/Independent reviewer/);
 await asUser('3',"select public.review_monthly_settlement($1,'approved','Independent review complete')",[id]);await asUser('3',"select public.review_monthly_settlement($1,'approved','Independent review complete')",[id]);
 await expect(asUser('3',"select public.review_monthly_settlement($1,'rejected','Changed review decision')",[id])).rejects.toThrow(/already recorded/);
 const records=(await asUser('2','select public.list_monthly_settlements($1) data',[org])).rows[0].data as Array<Record<string,unknown>>;
 expect(records[0]).toMatchObject({source_cad_minor:'10001',total_cny_minor:'12345',status:'approved'});expect(JSON.stringify(records)).not.toMatch(/PRIVATE_FX|PRIVATE RAW|PRIVATE OWNERSHIP/);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual([{n:0}]);expect((await db.query('select count(*)::int n from public.monthly_ad_reports')).rows).toEqual([{n:0}]);
 await expect(db.exec('delete from public.monthly_settlement_drafts')).rejects.toThrow(/immutable/);await expect(db.exec('delete from public.monthly_settlement_reviews')).rejects.toThrow(/immutable/);
});
it('blocks incomplete coverage, pending status, mismatched cost/company, unshared source and archived quotes',async()=>{
 for(const patch of [{check:'no_data'},{missingDates:['2024-01-31']},{daily:daily.slice(0,30)},{endBoundary:'last_day_label_unverified'},{dailySpendMicros:'1'}])await expect(prepare(await fixture(patch))).rejects.toThrow(/incomplete|mismatch/);
 await expect(prepare(await fixture({}, {sourceCadMinor:'10000'}))).rejects.toThrow(/source amount differs/);
 await expect(prepare(await fixture({}, {},other))).rejects.toThrow(/ownership or handoff/);
 await expect(prepare(await fixture({}, {},org,false))).rejects.toThrow(/ownership or handoff/);
 const f=await fixture();await asUser('1',"select public.set_agency_quote_archived($1,true,0,'Archived incorrect quote')",[f.quote]);await expect(prepare(f)).rejects.toThrow(/archived/);
});
it('scopes finance access, blocks non-MFA/client preparation, supports rejection and access pause',async()=>{
 const f=await fixture();for(const who of ['3','4'])await expect(prepare(f,who)).rejects.toThrow(/Forbidden/);
 await expect(asUser('2',"select public.prepare_monthly_settlement($1,$2,'Agreement','Prepared note')",[f.snapshot,f.quote],'aal1')).rejects.toThrow(/Forbidden/);
 const id=String((await prepare(f)).rows[0].id);
 await asUser('1',"select public.set_ads_binding_active($1,false,1,'Pause source access')",[f.binding]);expect((await asUser('3','select public.list_monthly_settlements($1) data',[org])).rows[0].data).not.toEqual(expect.arrayContaining([expect.objectContaining({id})]));
 await expect(asUser('3',"select public.review_monthly_settlement($1,'approved','Review paused source')",[id])).rejects.toThrow(/paused/);
 await asUser('1',"select public.set_ads_binding_active($1,true,2,'Restore source access')",[f.binding]);
 await asUser('3',"select public.review_monthly_settlement($1,'rejected','Fee agreement needs correction')",[id]);
 await expect(asUser('4','select public.list_monthly_settlements($1)',[org])).rejects.toThrow(/Forbidden/);
 expect((await asUser('2','select public.list_monthly_settlements($1) data',[other])).rows[0].data).toEqual([]);
});
