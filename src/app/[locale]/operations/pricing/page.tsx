import PricingRateSettings from '@/components/operations/PricingRateSettings';
import {resolvePricingRates,type PricingRateRow,type PricingRates} from '@/lib/billing/pricing-rates';
import RecordPicker from '@/components/workspace/RecordPicker';
import SavedAuditHistory from '@/components/workspace/SavedAuditHistory';
import styles from './PricingHistory.module.css';
import {operationsMenuLabel} from '@/lib/operations/navigation';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import QuoteArchiveForm from '@/components/operations/QuoteArchiveForm';
import AgencyQuoteCalculator from '@/components/operations/AgencyQuoteCalculator';
import {restoreQuoteSeed,type QuoteSeed} from '@/lib/billing/quote-snapshot';
import type {CloseOverview} from '@/lib/operations/month-close';
import {money} from '@/lib/billing/model';
export const dynamic='force-dynamic';
export const metadata={title:'内部报价管理 | 智点未来',robots:{index:false,follow:false}};
type QuoteRow={id:string;organization_id:string;period:string;revision:number;status:'draft'|'archived';state_revision:number;parent_id:string|null;total_cny_minor:string};
type PrivateQuote={rate?:string;source?:string;referenceDate?:string;costMinor?:string;note?:string;transferRule?:{includedInRate?:boolean}};
export default async function Pricing({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;edit?:string;archived?:string;month?:string;binding?:string;ratesScope?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams;if(query.month&&!z.iso.date().safeParse(query.month+'-01').success)notFound();if(query.binding&&!z.uuid().safeParse(query.binding).success)notFound();
 const [orgs,drafts]=await Promise.all([client.from('organizations').select('id,name').order('name').limit(500),client.from('agency_fee_rule_drafts').select('id,organization_id,unit_code,revision,effective_month,mode,basis,basis_points,fixed_minor,minimum_minor,waive_when_zero,note,currency').order('created_at',{ascending:false}).limit(100)]);
 const companies=orgs.data||[];const names=new Map(companies.map(o=>[o.id,o.name]));if(query.company&&(!z.uuid().safeParse(query.company).success||(!orgs.error&&!names.has(query.company))))notFound();
 let initial:QuoteSeed|undefined;let loadError=false;
 if(query.edit){
  if(!context.owner||!z.uuid().safeParse(query.edit).success)notFound();
  const loaded=await client.from('agency_quote_snapshots').select('id,organization_id,period,private_snapshot').eq('id',query.edit).maybeSingle();
  if(loaded.error)loadError=true;else if(!loaded.data)notFound();else{
   if(!names.has(loaded.data.organization_id)||(query.company&&query.company!==loaded.data.organization_id)||(query.month&&loaded.data.period!==query.month+'-01'))notFound();
   try{initial=restoreQuoteSeed(loaded.data.private_snapshot,{id:loaded.data.id,organizationId:loaded.data.organization_id,period:loaded.data.period});}catch{loadError=true;}
  }
 }
 const selectedCompany=initial?.organizationId||(query.company&&names.has(query.company)?query.company:companies[0]?.id);
 let contextSeed:{organizationId:string;period?:string;sourceCadMinor?:string}|undefined;
 if(!initial&&selectedCompany&&query.month&&context.owner){contextSeed={organizationId:selectedCompany,period:query.month+'-01'};if(query.binding){const overview=await client.rpc('get_month_close_overview',{p_org:selectedCompany,p_month:query.month+'-01'});if(overview.error)loadError=true;else{const source=(overview.data as CloseOverview).accounts.find(a=>a.binding_id===query.binding);if(!source)notFound();if(source.source_ready&&source.source_cad_minor!==null)contextSeed.sourceCadMinor=source.source_cad_minor;else loadError=true;}}}
 const ratesMonth=query.month||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date());
 let systemRate:PricingRateRow|undefined,customerRate:PricingRateRow|undefined,pricedScope:PricingRates|undefined;
 if(context.owner&&selectedCompany&&!initial){
  const rateQuery=()=>client.from('monthly_pricing_rates').select('revision,effective_month,canada_bps,china_bps,transfer_bps')
   .lte('effective_month',ratesMonth+'-01').order('effective_month',{ascending:false}).order('revision',{ascending:false}).limit(1);
  const [system,customer]=await Promise.all([
   rateQuery().is('organization_id',null).maybeSingle(),
   rateQuery().eq('organization_id',selectedCompany).maybeSingle(),
  ]);
  if(!system.error&&!customer.error){
   systemRate=system.data??undefined;
   customerRate=customer.data??undefined;
   pricedScope=resolvePricingRates(systemRate,customerRate);
   contextSeed??={organizationId:selectedCompany,period:ratesMonth+'-01'};
  }else if([system.error,customer.error].some(error=>error&&!['PGRST205','42P01'].includes(error.code)))loadError=true;
 }
 const systemScope=query.ratesScope==='system';
 const selectedMonth=query.month||initial?.period.slice(0,7);
 const workflowQuery=new URLSearchParams({...selectedCompany?{company:selectedCompany}:{},...selectedMonth?{month:selectedMonth}:{}});
 const includeArchived=query.archived==='yes';
 const results=selectedCompany?await client.rpc('list_agency_quotes',{p_org:selectedCompany,p_include_archived:includeArchived,...(selectedMonth?{p_month:selectedMonth+'-01'}:{})}):{data:[],error:null};
 const rows=(results.data||[]) as QuoteRow[];
 const privateQuotes=context.owner&&rows.length?await client.from('agency_quote_snapshots').select('id,private_snapshot').eq('organization_id',selectedCompany!).in('id',rows.map(r=>r.id)):{data:[],error:null};
 const privateMap=new Map((privateQuotes.data||[]).map(q=>[q.id,q.private_snapshot as PrivateQuote]));
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations`}>← {zh?'返回业务管理中心':'Operations'}</Link><h1>{operationsMenuLabel('pricing',['报价管理：试算、保存与修订','Quote management: calculate, save and revise'],context,locale)}</h1>
 {selectedCompany&&selectedMonth&&<nav className="billing-tabs" aria-label={zh?'报价后续流程':'Quote workflow'}><span>{names.get(selectedCompany)} · {selectedMonth}</span><Link className="service-link" href={`/${locale}/operations/month-close?${workflowQuery}`}>{zh?'返回本月月结工作台':'Return to this month close'}</Link><Link className="service-link" href={`/${locale}/operations/settlements?${workflowQuery}`}>{zh?'查看本月结算制单与复核':'View this month’s preparation and review'}</Link></nav>}
 {context.owner&&selectedCompany&&!initial&&<PricingRateSettings key={`${selectedCompany}:${ratesMonth}:${systemScope}`} systemDefaults={resolvePricingRates(systemRate)} locale={locale} companies={companies} company={selectedCompany} month={ratesMonth} systemScope={systemScope} stored={systemScope?systemRate:customerRate} effective={pricedScope&&(systemScope?resolvePricingRates(systemRate):pricedScope)}/>}
 {orgs.error?<p className="admin-error">{zh?'企业列表暂不可用。':'Companies unavailable.'}</p>:context.owner?(loadError?<p className="admin-error">{zh?'该报价暂不能安全载入，请刷新核查；未使用空白或零值替代原方案。':'This quote cannot be safely loaded. Refresh and check; missing inputs were not replaced with zeros.'} <Link href={`/${locale}/operations/pricing?${workflowQuery}`}>{zh?'返回新建报价':'New quote'}</Link></p>:<div id="quote-editor"><AgencyQuoteCalculator key={initial?.parentQuoteId||[selectedCompany,query.month,query.binding,systemRate?.revision,customerRate?.revision,pricedScope?.canada,pricedScope?.china,pricedScope?.transfer].join('-')} locale={locale} companies={companies} initial={initial} contextSeed={contextSeed} pricedScope={pricedScope}/></div>):<p className="admin-notice">{zh?'汇率与内部成本仅管理员可见。财务人员可查看已授权企业的报价结果。':'FX and internal costs are administrator-only. Finance staff may read authorized quote results.'}</p>}
 <section className="admin-panel" id="saved-quotes"><h2>{zh?'已保存内部报价（最近20条）':'Saved internal quotes (latest 20)'}</h2><form className={`admin-filter ${styles.filters}`} action={`/${locale}/operations/pricing#saved-quotes`}><label>{zh?'查看报价企业':'Quote company'}<select name="company" defaultValue={selectedCompany}>{companies.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{zh?'报价月份（留空查看全部）':'Quote month (blank for all)'}<input name="month" type="month" defaultValue={selectedMonth}/></label><label className="admin-checkbox"><input name="archived" type="checkbox" value="yes" defaultChecked={includeArchived}/>{zh?'包括已归档报价':'Include archived quotes'}</label><button className="button">{zh?'查看报价版本':'View quote versions'}</button></form>
 {results.error||privateQuotes.error?<p className="admin-error">{zh?'报价记录暂不可用，请稍后重试或联系管理员。':'Quote history is temporarily unavailable. Retry later or contact an administrator.'}</p>:!rows.length?<p>{zh?'当前筛选下暂无报价，可勾选“包括已归档报价”查询历史。':'No quotes match. Include archived quotes to view history.'}</p>:<RecordPicker label={locale==='zh'?'选择报价版本':'Select Quote revision'} locale={locale} hashPrefix="quote-" items={rows.map((q)=>({id:q.id,label:q.period.slice(0,7)+' · V'+q.revision+' · '+money(q.total_cny_minor,'CNY',locale)+' · '+q.status,active:false,content:(()=>{const details=privateMap.get(q.id);const archived=q.status==='archived';return <article className="admin-project" key={q.id} id={`quote-${q.id}`}><div className={styles.header}><div><h3 data-workspace-value>{names.get(selectedCompany||'')}</h3><p><span data-workspace-value>{q.period.slice(0,7)} · V{q.revision}</span></p><p>{archived?(zh?'已归档 · 原记录保留':'Archived · Original retained'):(zh?'内部草稿 · 未生效 · 未扣费':'Internal draft · Inactive · No debit')}</p></div><div className={styles.total}><p>{zh?'客户报价草稿总额':'Customer quote draft total'}</p><strong data-workspace-value>{money(q.total_cny_minor,'CNY',locale)}</strong></div></div><details className={styles.details}><summary>{zh?'版本详情':'Version details'}</summary><dl><div><dt>{zh?'报价编号':'Quote ID'}</dt><dd data-workspace-value>{q.id}</dd></div>{q.parent_id&&<div><dt>{zh?'基于历史报价':'Based on quote'}</dt><dd data-workspace-value>{q.parent_id}</dd></div>}</dl></details>
 {context.owner&&<div style={{display:'flex',gap:24,flexWrap:'wrap',marginTop:20}}><Link className="service-link" href={`/${locale}/operations/pricing?${new URLSearchParams({company:q.organization_id,month:q.period.slice(0,7),edit:q.id})}#quote-editor`}>{zh?'载入并重新编辑（另存新版本）':'Load and edit (save new version)'} ↗</Link><details><summary>{archived?(zh?'恢复报价':'Restore quote'):(zh?'归档报价':'Archive quote')}</summary><QuoteArchiveForm key={`${q.id}-${q.state_revision}`} locale={locale} quoteId={q.id} archived={archived} revision={q.state_revision} company={q.organization_id} month={q.period.slice(0,7)}/></details></div>}
 {context.owner&&details&&<details><summary>{zh?'管理员：内部汇率与成本':'Administrator: private FX and costs'}</summary><p>{details.source} · 1 CAD = {details.rate} CNY · {details.referenceDate||'Manual'}</p><p>{zh?'跨境成本试算：':'Illustrative transfer cost: '}{details.transferRule?.includedInRate?(zh?'已包含于综合汇率，未另列':'Embedded in all-in rate; not itemized'):money(details.costMinor||'0','CNY',locale)}</p><p>{details.note}</p></details>}</article>;})()}))}/>}</section>
 {context.owner&&await SavedAuditHistory({client,entityType:'quote_lifecycle',records:rows.map(q=>({id:q.id,label:`${names.get(q.organization_id)||q.organization_id} · ${q.period.slice(0,7)} · V${q.revision}`})),locale})}
 <details className="admin-panel"><summary>{zh?'历史收费规则草稿（仅供查阅）':'Historical fee-rule drafts (reference only)'}</summary><p>{zh?'旧记录保留，未自动应用于报价。日常报价请使用上方统一表单，无需再重复填写收费规则。':'Old records are retained and not automatically applied. Use the single quote form above; no duplicate rule entry is needed.'}</p>{drafts.error?<p className="admin-error">{zh?'历史规则暂不可用。':'Historical rules unavailable.'}</p>:!drafts.data?.length?<p>{zh?'暂无历史收费规则草稿。':'No historical fee-rule drafts.'}</p>:<RecordPicker label={locale==='zh'?'选择历史收费草稿':'Select Historical fee draft'} locale={locale} hashPrefix="fee-draft-" items={drafts.data.map((d)=>({id:d.id,label:(names.get(d.organization_id)||d.organization_id)+' · V'+d.revision+' · '+d.effective_month,active:false,content:<article key={d.id}>{names.get(d.organization_id)||d.organization_id} · {d.unit_code==='kbjm_ca'?'KBJM Canada':'智点未来 China'} · V{d.revision} · {d.effective_month} · {zh?'未生效':'Inactive'}<details><summary>{zh?'查看已保存的收费规则':'View saved fee rule'}</summary><p>{zh?'计算方式：':'Calculation: '}{d.mode==='percentage'?(zh?'按比例':'Percentage'):d.mode==='fixed'?(zh?'固定金额':'Fixed amount'):(zh?'比例与固定金额取较高者':'Greater of percentage or fixed')} · {zh?'基数：':'Basis: '}{d.basis==='platform_ad_spend'?(zh?'平台广告费用':'Platform advertising spend'):(zh?'上游总额':'Upstream total')}</p><p>{zh?'比例：':'Rate: '}{d.basis_points/100}% · {zh?'固定金额：':'Fixed amount: '}{money(String(d.fixed_minor),d.currency as 'CAD'|'CNY',locale)} · {zh?'最低金额：':'Minimum: '}{money(String(d.minimum_minor),d.currency as 'CAD'|'CNY',locale)}</p><p>{d.waive_when_zero?(zh?'基数为零时免收':'Waived when basis is zero'):(zh?'基数为零时不自动免收':'Not automatically waived at zero')}</p><p className="admin-prewrap">{d.note}</p></details></article>}))}/>}</details></main>;
}
