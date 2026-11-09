import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {buildQuoteSnapshot} from '../src/lib/billing/quote-snapshot';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const org='b0000000-0000-4000-8000-000000000001',other='b0000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/bootstrap/new-test-project.sql',import.meta.url),'utf8'));
 for(const name of ['018_agency_quote_snapshots','019_quote_revision_archive','020_ads_readonly_reporting','021_ads_source_handoff','023_ads_operational_periods','024_monthly_settlement_review','025_monthly_statement_posting','026_monthly_activity_coverage'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
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

it('publishes and debits atomically, returns the same receipt on retry and exposes only scoped customer fields',async()=>{
 const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
 const snapshot=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period:'2024-01-01',sourceCadMinor:'10001',rateMode:'manual',rate:'5',canada:rule,china:{...rule,basis:'upstream_total'},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'Verified fee terms'});
 const f=await fixture({},snapshot);const draft=String((await prepare(f)).rows[0].id);
 await db.exec(`insert into public.client_wallets(organization_id,currency) values('${org}','CNY');`);
 const wallet=String((await db.query<{id:string}>(`select id from public.client_wallets where organization_id='${org}' and currency='CNY'`)).rows[0].id);
 const publish=(id=draft,summary='已核实当月广告及约定服务费用')=>asUser('1','select public.publish_monthly_statement($1,$2,$3) id',[id,summary,JSON.stringify(snapshot)]);
 await expect(publish()).rejects.toThrow(/approval required/);
 await asUser('3',"select public.review_monthly_settlement($1,'approved','Independent review complete')",[draft]);
 await expect(publish()).rejects.toThrow(/Insufficient posted balance/);
 expect((await db.query('select count(*)::int n from public.monthly_client_statements')).rows).toEqual([{n:0}]);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',100000,'FICTIONAL TEST CREDIT','fictional-test-credit')",[wallet,org]);
 // Failure on the second debit must roll back the statement and the first debit.
 await db.exec(`create function public.test_fail_fee() returns trigger language plpgsql as $$begin if NEW.kind='service_fee' then raise exception 'forced fee failure';end if;return NEW;end$$;create trigger test_fail_fee before insert on public.wallet_entries for each row execute function public.test_fail_fee();`);
 await expect(publish()).rejects.toThrow(/forced fee failure/);
 expect((await db.query('select count(*)::int n from public.monthly_client_statements')).rows).toEqual([{n:0}]);expect((await db.query("select count(*)::int n from public.wallet_entries where kind<>'topup'")).rows).toEqual([{n:0}]);
 await db.exec('drop trigger test_fail_fee on public.wallet_entries;drop function public.test_fail_fee();');
 const posted=await publish();expect((await publish()).rows).toEqual(posted.rows);await expect(publish(draft,'Changed statement summary')).rejects.toThrow(/immutable/);
 expect((await db.query('select count(*)::int n from public.monthly_client_statements')).rows).toEqual([{n:1}]);
 expect((await db.query('select sum(amount_minor)::text balance from public.wallet_entries where wallet_id=$1',[wallet])).rows).toEqual([{balance:(100000n-BigInt(snapshot.finalMinor)).toString()}]);
 await expect(asUser('2','select public.publish_monthly_statement($1,$2,$3)',[draft,'Forbidden publish',JSON.stringify(snapshot)])).rejects.toThrow(/Forbidden/);
 await db.exec(`insert into public.memberships(organization_id,user_id,role) values('${org}','a0000000-0000-4000-8000-000000000004','viewer');insert into public.finance_access(organization_id,user_id,role) values('${org}','a0000000-0000-4000-8000-000000000004','viewer');`);
 const visible=(await asUser('4','select public.get_client_monthly_statements() data')).rows[0].data as Array<Record<string,unknown>>;
 expect(visible).toHaveLength(1);expect(visible[0].total_minor).toBe(snapshot.finalMinor);expect(JSON.stringify(visible)).not.toMatch(/private_snapshot|sourceCadMinor|PRIVATE|quote_id|binding_id|rate|costMinor/);
 expect((await asUser('2','select public.get_client_monthly_statements() data')).rows[0].data).toEqual([]);
 await db.exec(`delete from public.finance_access where user_id='a0000000-0000-4000-8000-000000000004';`);expect((await asUser('4','select public.get_client_monthly_statements() data')).rows[0].data).toEqual([]);
 // A different quote version for this same account/month cannot charge again.
 const q2=String((await asUser('1','select public.save_agency_quote_snapshot($1,$2,$3,$4,$5) id',[org,'2024-01-01',randomUUID(),'c'.repeat(64),JSON.stringify(snapshot)])).rows[0].id);
 const d2=String((await prepare({...f,quote:q2})).rows[0].id);await asUser('3',"select public.review_monthly_settlement($1,'approved','Reviewed alternative quote')",[d2]);
 await expect(publish(d2)).rejects.toThrow(/already published/);
 await expect(db.exec('delete from public.monthly_client_statements')).rejects.toThrow(/immutable/);
});

const inactiveDates=daily.map(d=>d.date);
const zeroPatch={daily:[],missingDates:inactiveDates,dailySpendMicros:'0',periodSpendMicros:null,check:'no_data',startBoundary:'unavailable',endBoundary:'unavailable',periodRange:null};
const coverageSubmit=(f:{snapshot:string},kind='zero',who='1',activeFrom:string|null=null,amount='0',impressions='0',request=randomUUID())=>asUser(who,"select public.submit_ads_month_coverage($1,$2,$3,$4,$5,'0','OFFICIAL-MONTHLY-EVIDENCE',$6,$7,'Checked official full-month totals and inactive dates') id",[f.snapshot,request,kind,amount,impressions,'d'.repeat(64),activeFrom]);
const coverageReview=(id:string,who='3')=>asUser(who,"select public.review_ads_month_coverage($1,'approved','Independently checked account, month and totals')",[id]);
const sourceProjection=async(snapshot:string)=>((await asUser('2','select public.list_ads_source_handoffs($1) data',[org])).rows[0].data as Array<Record<string,unknown>>).find(s=>s.snapshot_id===snapshot)!;
it('uses authoritative full-month totals to verify zero activity and only charges the agreed fixed fee',async()=>{
 const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
 const snapshot=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period:'2024-01-01',sourceCadMinor:'0',rateMode:'manual',rate:'5',canada:rule,china:{...rule,mode:'fixed',fixedMinor:'250',waiveWhenZero:false},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'Agreed fixed fee applies with no advertising'});
 const f=await fixture({...zeroPatch,periodSpendMicros:'0',periodImpressions:'0',periodClicks:'0',startBoundary:'requested',endBoundary:'exclusive',periodRange:{since:'2024-01-01',until:'2024-02-01'}},snapshot);
 const view=await sourceProjection(f.snapshot);expect(view.settlement_ready).toBe(true);expect(view.coverage_kind).toBe('aggregate_verified');expect(view.effective_amount_micros).toBe('0');expect((view.daily as unknown[])).toHaveLength(0);expect((view.effective_daily as Array<Record<string,unknown>>)).toHaveLength(31);expect((view.effective_daily as Array<Record<string,unknown>>)[0].origin).toBe('aggregate_zero');
 const draft=String((await prepare(f)).rows[0].id);await asUser('3',"select public.review_monthly_settlement($1,'approved','Verified zero usage and agreed fixed fee')",[draft]);
 const receipt=String((await asUser('1',"select public.publish_monthly_statement($1,'零广告使用，按约定收取固定服务费',$2) id",[draft,JSON.stringify(snapshot)])).rows[0].id);
 expect((await db.query("select kind,amount_minor::text amount from public.wallet_entries where source_reference=$1",['monthly-statement:'+receipt])).rows).toEqual([{kind:'service_fee',amount:'-250'}]);
 const stored=(await db.query<{report:{daily:unknown[]}}>('select report from public.ads_reporting_snapshots where id=$1',[f.snapshot])).rows[0].report;expect(stored.daily).toHaveLength(0);
});
it('keeps empty reads unknown until independent evidence review, distinguishing not-active accounts',async()=>{
 const f=await fixture(zeroPatch,{sourceCadMinor:'0'});expect((await sourceProjection(f.snapshot)).settlement_ready).toBe(false);await expect(prepare(f)).rejects.toThrow(/coverage incomplete/);
 await expect(coverageSubmit(f,'activity')).rejects.toThrow(/classification/);await expect(coverageSubmit(f,'not_active')).rejects.toThrow(/classification/);
 const request=randomUUID();const checked=await coverageSubmit(f,'not_active','1','2024-02-01','0','0',request);const id=String(checked.rows[0].id);expect((await coverageSubmit(f,'not_active','1','2024-02-01','0','0',request)).rows).toEqual(checked.rows);
 await expect(coverageReview(id,'1')).rejects.toThrow(/Independent authorized reviewer/);await expect(coverageReview(id,'4')).rejects.toThrow(/Independent authorized reviewer/);
 expect((await sourceProjection(f.snapshot)).settlement_ready).toBe(false);await coverageReview(id);await coverageReview(id);
 const view=await sourceProjection(f.snapshot);expect(view.settlement_ready).toBe(true);expect(view.coverage_kind).toBe('not_active');expect((view.effective_daily as Array<Record<string,unknown>>)[0].origin).toBe('not_active');
 const draft=String((await prepare(f)).rows[0].id);expect((await db.query('select coverage_kind,coverage_check_id from public.monthly_settlement_drafts where id=$1',[draft])).rows).toEqual([{coverage_kind:'not_active',coverage_check_id:id}]);
 await expect(db.exec('delete from public.ads_monthly_coverage_checks')).rejects.toThrow(/immutable/);await expect(db.exec('delete from public.ads_monthly_coverage_reviews')).rejects.toThrow(/immutable/);
});
it('supports activity on two days with reviewed gaps, but never accepts an amount or metric discrepancy',async()=>{
 const sparse=[{...daily[29],spendMicros:'100005000'},daily[30]];
 const patch={daily:sparse,missingDates:inactiveDates.slice(0,29),check:'no_data',startBoundary:'later_start_unverified',endBoundary:'exclusive',periodRange:{since:'2024-01-30',until:'2024-02-01'},periodImpressions:'2',periodClicks:'0'};
 const f=await fixture(patch);expect((await sourceProjection(f.snapshot)).settlement_ready).toBe(false);
 await expect(coverageSubmit(f,'zero','1',null,'100005000','2')).rejects.toThrow(/classification/);
 const id=String((await coverageSubmit(f,'activity','1',null,'100005000','2')).rows[0].id);await coverageReview(id);
 expect((await sourceProjection(f.snapshot)).coverage_kind).toBe('reviewed_activity');await expect(prepare(f)).resolves.toBeDefined();
 const second=String((await coverageSubmit(f,'activity','2',null,'100005000','2')).rows[0].id);await expect(coverageReview(second)).rejects.toThrow(/already approved/);
 for(const bad of [{...patch,periodSpendMicros:'100005001'},{...patch,periodImpressions:'3'}]){
 const wrong=await fixture(bad);expect((await sourceProjection(wrong.snapshot)).settlement_ready).toBe(false);await expect(coverageSubmit(wrong,'activity','1',null,'100005000','2')).rejects.toThrow(/totals must agree/);
 }
 const auto=await fixture({...patch,startBoundary:'requested',periodRange:{since:'2024-01-01',until:'2024-02-01'}});expect((await sourceProjection(auto.snapshot)).coverage_kind).toBe('aggregate_verified');await expect(prepare(auto)).resolves.toBeDefined();
});
