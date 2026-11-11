import {upstreamPaymentWorkbench} from '@/lib/billing/upstream-payments';
import {clientStatementSchema} from '@/lib/billing/client-statement';
import {applyMigrationsThrough} from './fixtures/migrations';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {buildQuoteSnapshot} from '../src/lib/billing/quote-snapshot';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const org='b0000000-0000-4000-8000-000000000001',other='b0000000-0000-4000-8000-000000000002';
beforeAll(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await applyMigrationsThrough(db,17);
 for(const name of ['018_agency_quote_snapshots','019_quote_revision_archive','020_ads_readonly_reporting','021_ads_source_handoff','023_ads_operational_periods','024_monthly_settlement_review','025_monthly_statement_posting','026_monthly_activity_coverage','027_month_close_workbench','028_upstream_reconciliation','029_upstream_payment_verification','030_upstream_payment_reversals'])await db.exec(await readFile(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
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
async function fixture(patch:Record<string,unknown>={},quotePatch:Record<string,unknown>={},quoteOrg=org,share=true,sourceOrg=org){
 const report={version:'ads-readonly-v1',account:{id:'adacct_fictional_'+randomUUID(),name:'FICTIONAL ACCOUNT',currency_code:'CAD',timezone:'UTC'},since:'2024-01-01',until:'2024-01-31',check:'matched',missingDates:[],endBoundary:'exclusive',dailySpendMicros:'100005000',periodSpendMicros:'100005000',rawSha256:'a'.repeat(64),daily,rawResponses:[{path:'/ad_account',body:'PRIVATE RAW SOURCE'}],...patch};
 const snapshot=String((await asUser('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).rows[0].id);
 const binding=String((await asUser('1',"select public.bind_ads_reporting_account($1,$2,'PRIVATE OWNERSHIP EVIDENCE') id",[snapshot,sourceOrg])).rows[0].id);
 if(share)await asUser('1',"select public.share_ads_source_snapshot($1,$2,'Internal source for review')",[snapshot,binding]);
 const quote=String((await asUser('1','select public.save_agency_quote_snapshot($1,$2,$3,$4,$5) id',[quoteOrg,report.since.slice(0,7)+'-01',randomUUID(),'b'.repeat(64),JSON.stringify({status:'draft',calculationVersion:'two-agency-v1',sourceCadMinor:'10001',finalMinor:'12345',rate:'PRIVATE_FX',...quotePatch})])).rows[0].id);
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
 const posted=await publish();expect((await publish()).rows).toEqual(posted.rows);
 const beforeRead=await db.query('select count(*)::int n from public.wallet_entries');
 const procurement=(await asUser('1',"select public.get_upstream_reconciliation('2024-01-01',$1) data",[org])).rows[0].data as {row_count:number;payment_status:string;rows:Array<Record<string,unknown>>;totals:Record<string,string>};
 expect(procurement.row_count).toBe(1);expect(procurement.payment_status).toBe('not_tracked');expect(procurement.rows[0].statement_id).toBe(posted.rows[0].id);expect(procurement.rows[0].quote_id).toBe(f.quote);
 expect(procurement.totals.procurement_cad_minor).toBe(snapshot.upstreamCadMinor);expect(procurement.totals.source_cad_minor).toBe(snapshot.sourceCadMinor);expect(procurement.totals.canada_fee_cad_minor).toBe(snapshot.canadaFeeCadMinor);expect(procurement.totals.customer_charged_cny_minor).toBe(snapshot.finalMinor);
 expect(JSON.stringify(procurement)).not.toMatch(/rawResponses|private_snapshot|referenceDate|rateMode|PRIVATE/);expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual(beforeRead.rows);
 for(const who of ['2','3','4'])await expect(asUser(who,"select public.get_upstream_reconciliation('2024-01-01',$1)",[org])).rejects.toThrow(/Forbidden/);
 await expect(asUser('1',"select public.get_upstream_reconciliation('2024-01-01',$1)",[org],'aal1')).rejects.toThrow(/Forbidden/);
 await expect(asUser('1',"select public.get_upstream_reconciliation('2024-01-02',$1)",[org])).rejects.toThrow(/Month must start/);
 const empty=(await asUser('1',"select public.get_upstream_reconciliation('2024-02-01',$1) data",[org])).rows[0].data as {row_count:number;rows:unknown[];totals:Record<string,string>};expect(empty.row_count).toBe(0);expect(empty.rows).toEqual([]);expect(empty.totals.procurement_cad_minor).toBe('0');
await expect(publish(draft,'Changed statement summary')).rejects.toThrow(/immutable/);
 expect((await db.query('select count(*)::int n from public.monthly_client_statements')).rows).toEqual([{n:1}]);
 expect((await db.query('select sum(amount_minor)::text balance from public.wallet_entries where wallet_id=$1',[wallet])).rows).toEqual([{balance:(100000n-BigInt(snapshot.finalMinor)).toString()}]);
 await expect(asUser('2','select public.publish_monthly_statement($1,$2,$3)',[draft,'Forbidden publish',JSON.stringify(snapshot)])).rejects.toThrow(/Forbidden/);
 await db.exec(`insert into public.memberships(organization_id,user_id,role) values('${org}','a0000000-0000-4000-8000-000000000004','viewer');insert into public.finance_access(organization_id,user_id,role) values('${org}','a0000000-0000-4000-8000-000000000004','viewer');`);
 const visible=(await asUser('4','select public.get_client_monthly_statements() data')).rows[0].data as Array<Record<string,unknown>>;
 expect(visible).toHaveLength(1);expect(clientStatementSchema.array().safeParse(visible).success).toBe(true);expect(visible[0].total_minor).toBe(snapshot.finalMinor);expect(JSON.stringify(visible)).not.toMatch(/private_snapshot|sourceCadMinor|PRIVATE|quote_id|binding_id|rate|costMinor/);
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
 expect((await coverageSubmit(f,'not_active','1','2024-02-01','0','0',request)).rows).toEqual(checked.rows);
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

it('tracks every close step by account/month, scopes old records before limits, and never writes while querying',async()=>{
 const dates=(await db.query<{period_start:string;period_end:string}>("select (date_trunc('month',now())-interval '1 month')::date::text period_start,(date_trunc('month',now())-interval '1 day')::date::text period_end")).rows[0];
 const month=dates.period_start,until=dates.period_end;const rows=Array.from({length:Number(until.slice(8,10))},(_,i)=>({date:month.slice(0,8)+String(i+1).padStart(2,'0'),spendMicros:i===0?'100005000':'0',impressions:'1',clicks:'0'}));
 const weekly=rows.slice(-7).map((d,i)=>({...d,spendMicros:i===0?'100005000':'0'}));
 const week=await fixture({since:weekly[0].date,until,daily:weekly},{sourceCadMinor:'777'},other,true,other);
 const overview=async(who='2')=>(await asUser(who,'select public.get_month_close_overview($1,$2) data',[other,month])).rows[0].data as {accounts:Array<Record<string,unknown>>};
 const account=async(binding:string)=>(await overview()).accounts.find(a=>a.binding_id===binding)!;
 expect((await account(week.binding)).stage).toBe('source_needed');expect((await account(week.binding)).operational_source_count).toBe(1);
 const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
 const snapshot=buildQuoteSnapshot({requestId:randomUUID(),organizationId:other,period:month,sourceCadMinor:'10001',rateMode:'manual',rate:'5',canada:rule,china:{...rule,basis:'upstream_total'},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'Verified fee terms'});
 const f=await fixture({since:month,until,daily:rows},snapshot,other,false,other);
 expect((await account(f.binding)).stage).toBe('handoff_needed');expect((await account(f.binding)).source_id).toBeNull();
 await asUser('1',"select public.share_ads_source_snapshot($1,$2,'Hand off complete month')",[f.snapshot,f.binding]);
 expect((await account(f.binding)).stage).toBe('preparation_needed');
 await asUser('1',"select public.set_agency_quote_archived($1,true,0,'Check missing quote step')",[f.quote]);expect((await account(f.binding)).stage).toBe('quote_needed');
 await asUser('1',"select public.set_agency_quote_archived($1,false,1,'Restore verified quote')",[f.quote]);
 const draft=String((await prepare(f)).rows[0].id);expect((await account(f.binding)).stage).toBe('settlement_review_needed');expect((await account(f.binding)).draft_prepared_by_me).toBe(true);
 await asUser('3',"select public.review_monthly_settlement($1,'approved','Independent monthly review')",[draft]);expect((await account(f.binding)).stage).toBe('wallet_needed');
 await db.query("insert into public.client_wallets(organization_id,currency) values($1,'CNY')",[other]);expect((await account(f.binding)).stage).toBe('funding_needed');
 const wallet=String((await db.query<{id:string}>("select id from public.client_wallets where organization_id=$1 and currency='CNY'",[other])).rows[0].id);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',200000,'FICTIONAL WORKBENCH CREDIT','fictional-workbench-credit')",[wallet,other]);expect((await account(f.binding)).stage).toBe('publication_ready');
 const countBefore=(await db.query('select count(*)::int n from public.wallet_entries')).rows;await overview();expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual(countBefore);
 const posted=String((await asUser('1',"select public.publish_monthly_statement($1,'核实整月广告及约定服务费用',$2) id",[draft,JSON.stringify(snapshot)])).rows[0].id);expect((await account(f.binding)).stage).toBe('published');expect((await account(f.binding)).statement_id).toBe(posted);
 await asUser('1',"select public.set_ads_binding_active($1,false,1,'Pause after statement publication')",[f.binding]);expect((await account(f.binding)).stage).toBe('published');expect((await account(f.binding)).source_id).toBeNull();
 await asUser('1',"select public.set_ads_binding_active($1,true,2,'Restore source access')",[f.binding]);
 const original=(await db.query<{report:Record<string,unknown>}>('select report from public.ads_reporting_snapshots where id=$1',[f.snapshot])).rows[0].report;
 for(let i=0;i<21;i++){
 const report={...original,since:'2024-01-01',until:'2024-01-31',daily:[],missingDates:inactiveDates,dailySpendMicros:'0',periodSpendMicros:'0',periodImpressions:'0',periodClicks:'0',startBoundary:'requested',endBoundary:'exclusive',periodRange:{since:'2024-01-01',until:'2024-02-01'}};
 const id=String((await asUser('1','select public.save_ads_reporting_snapshot($1,$2) id',[randomUUID(),JSON.stringify(report)])).rows[0].id);await asUser('1',"select public.share_ads_source_snapshot($1,$2,'Later retrieval of a different historical month')",[id,f.binding]);
 }
 const broad=(await asUser('2','select public.list_ads_source_handoffs($1) data',[other])).rows[0].data as Array<Record<string,unknown>>;expect(broad.some(s=>s.snapshot_id===f.snapshot)).toBe(false);
 const scoped=(await asUser('2','select public.list_ads_source_handoffs($1,$2) data',[other,month])).rows[0].data as Array<Record<string,unknown>>;expect(scoped.some(s=>s.snapshot_id===f.snapshot)).toBe(true);expect((await account(f.binding)).stage).toBe('published');
 expect(JSON.stringify(await overview())).not.toMatch(/private_snapshot|rawResponses|evidence_sha256|ownership_reference/);
 await expect(overview('4')).rejects.toThrow(/Forbidden/);await expect(asUser('1','select public.get_month_close_overview($1,$2)',[other,month],'aal1')).rejects.toThrow(/Forbidden/);
 await expect(asUser('1',"select public.get_month_close_overview($1,'2024-01-02')",[other])).rejects.toThrow(/Month must start/);
});

it('aggregates posted procurement across accounts while excluding unpublished drafts and retaining archived history',async()=>{
 const period='2023-09-01';const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
 const quote=buildQuoteSnapshot({requestId:randomUUID(),organizationId:org,period,sourceCadMinor:'10001',rateMode:'manual',rate:'5',canada:rule,china:{...rule,basis:'upstream_total'},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'FICTIONAL PROCUREMENT TEST'});
 const days=Array.from({length:30},(_,i)=>({date:`2023-09-${String(i+1).padStart(2,'0')}`,spendMicros:i===0?'100005000':'0',impressions:'1',clicks:'0'}));
 const wallet=String((await db.query<{id:string}>("select id from public.client_wallets where organization_id=$1 and currency='CNY'",[org])).rows[0].id);
 await db.query("insert into public.wallet_entries(wallet_id,organization_id,currency,kind,amount_minor,description,source_reference) values($1,$2,'CNY','topup',1000000,'FICTIONAL PROCUREMENT CREDIT',$3)",[wallet,org,randomUUID()]);
 const records=[];for(let i=0;i<3;i++){
  const f=await fixture({since:period,until:'2023-09-30',daily:days},quote);const draft=String((await prepare(f)).rows[0].id);records.push(f);
  if(i<2){await asUser('3',"select public.review_monthly_settlement($1,'approved','Independent procurement fixture review')",[draft]);await asUser('1',"select public.publish_monthly_statement($1,'FICTIONAL POSTED PROCUREMENT',$2)",[draft,JSON.stringify(quote)]);}
 }
 await asUser('1',"select public.set_agency_quote_archived($1,true,0,'Archive quote after historical posting')",[records[0].quote]);
 await asUser('1',"select public.set_ads_binding_active($1,false,1,'Pause source access after historical posting')",[records[0].binding]);
 const entries=await db.query('select count(*)::int n from public.wallet_entries');
 const value=(await asUser('1','select public.get_upstream_reconciliation($1,$2) data',[period,org])).rows[0].data as {row_count:number;rows:unknown[];totals:Record<string,string>};
 expect(value.row_count).toBe(2);expect(value.rows).toHaveLength(2);expect(value.totals.procurement_cad_minor).toBe((BigInt(quote.upstreamCadMinor)*2n).toString());expect(value.totals.customer_charged_cny_minor).toBe((BigInt(quote.finalMinor)*2n).toString());
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual(entries.rows);
 const otherScope=(await asUser('1','select public.get_upstream_reconciliation($1,$2) data',[period,other])).rows[0].data as {row_count:number};expect(otherScope.row_count).toBe(0);
});

it('independently verifies partial/batch CAD receipts, rejects overlaps, preserves corrections and never debits clients',async()=>{
 const statements=(await db.query<{id:string}>("select id from public.monthly_client_statements where organization_id=$1 and month='2023-09-01' order by id",[org])).rows;
 expect(statements).toHaveLength(2);const [first,second]=statements.map(s=>s.id);
 const alloc=(id:string,amount:string)=>({statementId:id,amountMinor:amount});const ref='FICTIONAL-BANK-'+randomUUID();
 async function submit(reference:string,received:string,allocations:unknown[],request=randomUUID(),organization=org,date='2024-01-01',who='2'){
 return asUser(who,"select public.submit_upstream_payment($1,$2,$3,$4,$5,'FICTIONAL EVIDENCE',$6,'Verified payer and CAD net receipt',$7) id",[request,organization,reference,date,received,'a'.repeat(64),JSON.stringify(allocations)]);}
 const before=(await db.query('select count(*)::int n from public.wallet_entries')).rows;
 const request=randomUUID(),a=[alloc(first,'600'),alloc(second,'400')];const p=String((await submit(ref,'1000',a,request)).rows[0].id);
 expect((await submit(ref,'1000',a,request)).rows[0].id).toBe(p);await expect(submit(ref,'1001',a,request)).rejects.toThrow(/request changed/);await expect(submit(ref.toLowerCase(),'1000',a)).rejects.toThrow(/already registered/);
 const get=async()=>((await asUser('3',"select public.get_upstream_payment_workbench($1,'2023-09-01') data",[org])).rows[0].data as {statements:Array<{id:string;verified_cad_minor:string;pending_cad_minor:string}>;payments:Array<{id:string;status:string;revision:number}>});
 let work=await get();expect(work.statements.find(s=>s.id===first)).toMatchObject({verified_cad_minor:'0',pending_cad_minor:'600'});expect(work.payments.find(r=>r.id===p)?.status).toBe('pending');expect(JSON.stringify(work)).not.toMatch(/PRIVATE|private_snapshot|rateMode|upstream_cny|chinaFee/);
 await expect(asUser('2',"select public.review_upstream_payment($1,'approved','Self review forbidden')",[p])).rejects.toThrow(/Forbidden|Independent/);
 await asUser('3',"select public.review_upstream_payment($1,'approved','Independent receipt and allocation check')",[p]);await asUser('3',"select public.review_upstream_payment($1,'approved','Independent receipt and allocation check')",[p]);
 work=await get();expect(work.statements.find(s=>s.id===first)?.verified_cad_minor).toBe('600');
 const ref2='FICTIONAL-BANK-'+randomUUID();const competing=String((await submit(ref2,'11001',[alloc(first,'11001')])).rows[0].id);
 await expect(asUser('3',"select public.review_upstream_payment($1,'approved','Check remaining procurement')",[competing])).rejects.toThrow(/exceeds unreconciled/);
 expect((await get()).payments.find(r=>r.id===competing)?.status).toBe('pending');
 await asUser('3',"select public.review_upstream_payment($1,'rejected','Incorrect allocation; correct receipt matching')",[competing]);
 const correction=String((await submit(ref2,'10000',[alloc(first,'10000')])).rows[0].id);expect(correction).not.toBe(competing);expect((await get()).payments.find(r=>r.id===correction)?.revision).toBe(2);
 await asUser('3',"select public.review_upstream_payment($1,'approved','Independent corrected allocation check')",[correction]);
 const badBatch=String((await submit('FICTIONAL-BANK-'+randomUUID(),'11002',[alloc(first,'1'),alloc(second,'11001')])).rows[0].id);
 await expect(asUser('3',"select public.review_upstream_payment($1,'approved','Atomic batch check')",[badBatch])).rejects.toThrow(/exceeds unreconciled/);expect((await get()).statements.find(s=>s.id===first)?.verified_cad_minor).toBe('10600');
 await asUser('3',"select public.review_upstream_payment($1,'rejected','Whole batch requires corrected allocation')",[badBatch]);
 const final=String((await submit('FICTIONAL-BANK-'+randomUUID(),'11002',[alloc(first,'401'),alloc(second,'10601')])).rows[0].id);
 await asUser('3',"select public.review_upstream_payment($1,'approved','Remaining procurement independently checked')",[final]);work=await get();expect(work.statements.map(s=>s.verified_cad_minor)).toEqual(['11001','11001']);
 const adminOwn=String((await submit('FICTIONAL-BANK-'+randomUUID(),'1',[alloc(first,'1')],randomUUID(),org,'2024-01-01','1')).rows[0].id);
 await expect(asUser('1',"select public.review_upstream_payment($1,'approved','Admin self review blocked')",[adminOwn])).rejects.toThrow(/Independent reviewer/);
 await asUser('3',"select public.review_upstream_payment($1,'rejected','Procurement already reconciled')",[adminOwn]);
 await expect(submit('FICTIONAL-BANK-'+randomUUID(),'1000',[alloc(first,'900')])).rejects.toThrow(/total or duplicate/);
 await expect(submit('FICTIONAL-BANK-'+randomUUID(),'1000',[alloc(first,'500'),alloc(first,'500')])).rejects.toThrow(/total or duplicate/);
 await expect(submit('FICTIONAL-BANK-'+randomUUID(),'1',[alloc(first,'1')],randomUUID(),other)).rejects.toThrow(/organization mismatch|Forbidden/);
 await expect(submit('FICTIONAL-BANK-'+randomUUID(),'1',[alloc(first,'1')],randomUUID(),org,'2999-01-01')).rejects.toThrow(/input invalid/);
 for(const who of ['3','4'])await expect(submit('FICTIONAL-BANK-'+randomUUID(),'1',[alloc(first,'1')],randomUUID(),org,'2024-01-01',who)).rejects.toThrow(/Forbidden/);
 await expect(asUser('4',"select public.get_upstream_payment_workbench($1,'2023-09-01')",[org])).rejects.toThrow(/Forbidden/);await expect(asUser('3',"select public.get_upstream_payment_workbench($1,'2023-09-01')",[org],'aal1')).rejects.toThrow(/Forbidden/);
 await expect(db.query('delete from public.upstream_payment_reviews where payment_id=$1',[p])).rejects.toThrow(/immutable/);await expect(db.query('update public.upstream_payment_records set received_cad_minor=1 where id=$1',[p])).rejects.toThrow(/immutable/);
 await expect(asUser('3',"select public.review_upstream_payment($1,'rejected','Changed historical result')",[p])).rejects.toThrow(/already recorded/);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual(before);
});

it('reverses whole approved allocations independently, preserves history and permits a corrected bank-reference revision',async()=>{
 const original=(await db.query<{id:string;bank_reference:string;allocations:Array<{statementId:string;amountMinor:string}>}>("select p.id,p.bank_reference,p.allocations from public.upstream_payment_records p join public.upstream_payment_reviews r on r.payment_id=p.id where p.organization_id=$1 and r.decision='approved' and p.received_cad_minor=1000 limit 1",[org])).rows[0];
 const unchanged=(await db.query('select count(*)::int n from public.wallet_entries')).rows;
 const originalRows=(await db.query('select to_jsonb(p) original from public.upstream_payment_records p where p.id=$1',[original.id])).rows;
 const work=async()=>((await asUser('3',"select public.get_upstream_payment_workbench($1,'2023-09-01') data",[org])).rows[0].data as {reversal_enabled:boolean;statements:Array<{id:string;verified_cad_minor:string}>;payments:Array<{id:string;reversed:boolean;reversal_pending:boolean;reversals:Array<{status:string;revision:number}>}>});
 const before=await work();expect(before.reversal_enabled).toBe(true);
 const propose=(request=randomUUID(),who='2',reason='Incorrect receipt amount; check original evidence')=>asUser(who,"select public.submit_upstream_reversal($1,$2,$3,'CONTROLLED REVERSAL EVIDENCE',$4) id",[original.id,request,reason,'b'.repeat(64)]);
 const request=randomUUID(),r=String((await propose(request)).rows[0].id);expect((await propose(request)).rows[0].id).toBe(r);await expect(propose(request,'2','Changed request content')).rejects.toThrow(/request changed/);await expect(propose()).rejects.toThrow(/already pending/);
 const pending=await work();expect(pending.statements).toEqual(before.statements);expect(pending.payments.find(p=>p.id===original.id)).toMatchObject({reversed:false,reversal_pending:true});
 const replace=(amount='900',allocations=original.allocations.map((a,i)=>({...a,amountMinor:String(BigInt(a.amountMinor)-(i===0?100n:0n))})))=>asUser('2',"select public.submit_upstream_payment($1,$2,$3,'2024-01-01',$4,'CORRECTED RECEIPT EVIDENCE',$5,'Corrected independently confirmed CAD receipt',$6) id",[randomUUID(),org,original.bank_reference,amount,'c'.repeat(64),JSON.stringify(allocations)]);
 await expect(replace()).rejects.toThrow(/already registered/);
 await asUser('3',"select public.review_upstream_reversal($1,'rejected','Need clearer correction evidence')",[r]);expect((await work()).statements).toEqual(before.statements);
 const req2=randomUUID(),r2=String((await propose(req2,'1')).rows[0].id);
 await expect(asUser('1',"select public.review_upstream_reversal($1,'approved','Admin self review blocked')",[r2])).rejects.toThrow(/Independent reviewer/);
 for(const who of ['2','4'])await expect(asUser(who,"select public.review_upstream_reversal($1,'approved','Unauthorized review blocked')",[r2])).rejects.toThrow(/Forbidden/);
 await expect(asUser('3',"select public.review_upstream_reversal($1,'approved','MFA required')",[r2],'aal1')).rejects.toThrow(/Forbidden/);
 await asUser('3',"select public.review_upstream_reversal($1,'approved','Original net amount and whole batch correction verified')",[r2]);await asUser('3',"select public.review_upstream_reversal($1,'approved','Original net amount and whole batch correction verified')",[r2]);
 const reversed=await work();expect(upstreamPaymentWorkbench.safeParse(reversed).success).toBe(true);for(const a of original.allocations){const old=before.statements.find(s=>s.id===a.statementId)!;expect(reversed.statements.find(s=>s.id===a.statementId)?.verified_cad_minor).toBe((BigInt(old.verified_cad_minor)-BigInt(a.amountMinor)).toString());}
 expect(reversed.payments.find(p=>p.id===original.id)).toMatchObject({reversed:true,reversal_pending:false,reversals:[{revision:2,status:'approved'},{revision:1,status:'rejected'}]});
 await expect(propose()).rejects.toThrow(/already pending or approved/);await expect(asUser('3',"select public.review_upstream_reversal($1,'rejected','Changed historical decision')",[r2])).rejects.toThrow(/already recorded/);
 const originalReview=(await db.query<{note:string}>('select note from public.upstream_payment_reviews where payment_id=$1',[original.id])).rows[0].note;
 await asUser('3',"select public.review_upstream_payment($1,'approved',$2)",[original.id,originalReview]);expect((await work()).statements).toEqual(reversed.statements);
 await expect(asUser('2',"select public.submit_upstream_reversal($1,$2,'MFA required','Evidence',$3)",[original.id,randomUUID(),'a'.repeat(64)],'aal1')).rejects.toThrow(/Forbidden/);
 const corrected=String((await replace()).rows[0].id);await asUser('3',"select public.review_upstream_payment($1,'approved','Correct net CAD and allocations verified')",[corrected]);
 expect((await db.query<{revision:number}>('select revision from public.upstream_payment_records where id=$1',[corrected])).rows[0].revision).toBe(2);
 expect((await db.query('select to_jsonb(p) original from public.upstream_payment_records p where p.id=$1',[original.id])).rows).toEqual(originalRows);
 expect((await db.query('select count(*)::int n from public.wallet_entries')).rows).toEqual(unchanged);
 await expect(db.query('delete from public.upstream_payment_reversals where id=$1',[r2])).rejects.toThrow(/immutable/);await expect(db.query('update public.upstream_reversal_reviews set note=$1 where reversal_id=$2',['Changed note',r2])).rejects.toThrow(/immutable/);
 await expect(propose(randomUUID(),'4')).rejects.toThrow(/Forbidden/);await expect(asUser('3',"select public.submit_upstream_reversal($1,$2,'No prepare role','Evidence',$3)",[corrected,randomUUID(),'a'.repeat(64)])).rejects.toThrow(/Forbidden/);
 const notApproved=(await db.query<{id:string}>("select p.id from public.upstream_payment_records p join public.upstream_payment_reviews r on r.payment_id=p.id where r.decision='rejected' limit 1")).rows[0].id;
 await expect(asUser('2',"select public.submit_upstream_reversal($1,$2,'Cannot reverse rejected record','Evidence',$3)",[notApproved,randomUUID(),'a'.repeat(64)])).rejects.toThrow(/Approved receipt required/);
});
