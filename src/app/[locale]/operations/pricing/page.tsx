import {notFound} from 'next/navigation';
import Link from 'next/link';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import AdminForm from '@/components/admin/AdminForm';
import AgencyQuoteCalculator from '@/components/operations/AgencyQuoteCalculator';
import {restoreQuoteSeed,type QuoteSeed} from '@/lib/billing/quote-snapshot';
import {money} from '@/lib/billing/model';
export const dynamic='force-dynamic';
export const metadata={title:'内部报价管理 | 智点未来',robots:{index:false,follow:false}};
type QuoteRow={id:string;organization_id:string;period:string;revision:number;status:'draft'|'archived';state_revision:number;parent_id:string|null;total_cny_minor:string};
type PrivateQuote={rate?:string;source?:string;referenceDate?:string;costMinor?:string;note?:string;transferRule?:{includedInRate?:boolean}};
export default async function Pricing({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;edit?:string;archived?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams;
 const [orgs,drafts]=await Promise.all([client.from('organizations').select('id,name').order('name').limit(500),client.from('agency_fee_rule_drafts').select('id,organization_id,unit_code,revision,effective_month,mode').order('created_at',{ascending:false}).limit(100)]);
 const companies=orgs.data||[];const names=new Map(companies.map(o=>[o.id,o.name]));
 let initial:QuoteSeed|undefined;let loadError=false;
 if(query.edit){
  if(!context.owner||!z.uuid().safeParse(query.edit).success)notFound();
  const loaded=await client.from('agency_quote_snapshots').select('id,organization_id,period,private_snapshot').eq('id',query.edit).maybeSingle();
  if(loaded.error)loadError=true;else if(!loaded.data)notFound();else{
   if(!names.has(loaded.data.organization_id)||(query.company&&query.company!==loaded.data.organization_id))notFound();
   try{initial=restoreQuoteSeed(loaded.data.private_snapshot,{id:loaded.data.id,organizationId:loaded.data.organization_id,period:loaded.data.period});}catch{loadError=true;}
  }
 }
 const selectedCompany=initial?.organizationId||(query.company&&names.has(query.company)?query.company:companies[0]?.id);
 const includeArchived=query.archived==='yes';
 const results=selectedCompany?await client.rpc('list_agency_quotes',{p_org:selectedCompany,p_include_archived:includeArchived}):{data:[],error:null};
 const rows=(results.data||[]) as QuoteRow[];
 const privateQuotes=context.owner&&rows.length?await client.from('agency_quote_snapshots').select('id,private_snapshot').eq('organization_id',selectedCompany!).in('id',rows.map(r=>r.id)):{data:[],error:null};
 const privateMap=new Map((privateQuotes.data||[]).map(q=>[q.id,q.private_snapshot as PrivateQuote]));
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations`}>← {zh?'返回三方运营中心':'Operations'}</Link><h1>{zh?'报价管理：试算、保存与修订':'Quote management: calculate, save and revise'}</h1><p className="admin-notice">{zh?'统一从上方输入并保存报价。重新编辑会另存新版本，归档可恢复；这些操作均不代表客户接受，不形成应收应付，也不扣客户余额。':'Use one form to calculate and save quotes. Editing creates a new version; archiving is reversible. No customer acceptance, receivable, payable or wallet debit occurs.'}</p>
 {orgs.error?<p className="admin-error">{zh?'企业列表暂不可用。':'Companies unavailable.'}</p>:context.owner?(loadError?<p className="admin-error">{zh?'该报价暂不能安全载入，请刷新核查；未使用空白或零值替代原方案。':'This quote cannot be safely loaded. Refresh and check; missing inputs were not replaced with zeros.'} <Link href={`/${locale}/operations/pricing`}>{zh?'返回新建报价':'New quote'}</Link></p>:<div id="quote-editor"><AgencyQuoteCalculator key={initial?.parentQuoteId||'new'} locale={locale} companies={companies} initial={initial}/></div>):<p className="admin-notice">{zh?'汇率与内部成本仅管理员可见。财务人员可查看已授权企业的报价结果。':'FX and internal costs are administrator-only. Finance staff may read authorized quote results.'}</p>}
 <section className="admin-panel" id="saved-quotes"><h2>{zh?'已保存内部报价（最近20条）':'Saved internal quotes (latest 20)'}</h2><form className="admin-filter" action={`/${locale}/operations/pricing#saved-quotes`}><label>{zh?'查看报价企业':'Quote company'}<select name="company" defaultValue={selectedCompany}>{companies.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="admin-checkbox"><input name="archived" type="checkbox" value="yes" defaultChecked={includeArchived}/>{zh?'包括已归档报价':'Include archived quotes'}</label><button className="button">{zh?'查看报价版本':'View quote versions'}</button></form>
 {results.error||privateQuotes.error?<p className="admin-error">{zh?'报价记录暂不可用，请检查019数据库更新。':'Quote history unavailable. Check database update 019.'}</p>:!rows.length?<p>{zh?'当前筛选下暂无报价，可勾选“包括已归档报价”查询历史。':'No quotes match. Include archived quotes to view history.'}</p>:rows.map(q=>{const details=privateMap.get(q.id);const archived=q.status==='archived';return <article className="admin-project" key={q.id}><h3>{names.get(selectedCompany||'')} · {q.period.slice(0,7)} · V{q.revision}</h3><p>{archived?(zh?'已归档 · 原记录保留':'Archived · Original retained'):(zh?'内部草稿 · 未生效 · 未扣费':'Internal draft · Inactive · No debit')}</p><strong>{zh?'客户报价草稿总额：':'Customer quote draft total: '}{money(q.total_cny_minor,'CNY',locale)}</strong>{q.parent_id&&<p className="workflow-byline">{zh?'基于历史报价：':'Based on quote: '}{q.parent_id}</p>}
 {context.owner&&<div style={{display:'flex',gap:24,flexWrap:'wrap',marginTop:20}}><Link className="service-link" href={`/${locale}/operations/pricing?company=${selectedCompany}&edit=${q.id}#quote-editor`}>{zh?'载入并重新编辑（另存新版本）':'Load and edit (save new version)'} ↗</Link><details><summary>{archived?(zh?'恢复报价':'Restore quote'):(zh?'归档报价':'Archive quote')}</summary><AdminForm locale={locale} endpoint="/api/admin/quote-archive" button={archived?(zh?'确认恢复':'Restore'):(zh?'确认归档（保留历史）':'Archive (keep history)')}><input name="id" type="hidden" value={q.id}/><input name="archived" type="hidden" value={archived?'no':'yes'}/><input name="revision" type="hidden" value={q.state_revision}/><label>{zh?'操作说明':'Reason'}<textarea name="note" required minLength={3} maxLength={1000}/></label><label className="admin-checkbox"><input name="confirm" type="checkbox" required/>{zh?'确认只调整列表归档状态，不删除原报价、不改变余额。':'Only change archive status; keep the original quote and balances.'}</label></AdminForm></details></div>}
 {context.owner&&details&&<details><summary>{zh?'管理员：内部汇率与成本':'Administrator: private FX and costs'}</summary><p>{details.source} · 1 CAD = {details.rate} CNY · {details.referenceDate||'Manual'}</p><p>{zh?'跨境成本试算：':'Illustrative transfer cost: '}{details.transferRule?.includedInRate?(zh?'已包含于综合汇率，未另列':'Embedded in all-in rate; not itemized'):money(details.costMinor||'0','CNY',locale)}</p><p>{details.note}</p></details>}<p className="workflow-byline">{q.id}</p></article>;})}</section>
 <details className="admin-panel"><summary>{zh?'历史收费规则草稿（仅供查阅）':'Historical fee-rule drafts (reference only)'}</summary><p>{zh?'旧记录保留，未自动应用于报价。日常报价请使用上方统一表单，无需再重复填写收费规则。':'Old records are retained and not automatically applied. Use the single quote form above; no duplicate rule entry is needed.'}</p>{drafts.error?<p className="admin-error">{zh?'历史规则暂不可用。':'Historical rules unavailable.'}</p>:!drafts.data?.length?<p>{zh?'暂无历史收费规则草稿。':'No historical fee-rule drafts.'}</p>:drafts.data.map(d=><p key={d.id}>{names.get(d.organization_id)||d.organization_id} · {d.unit_code==='kbjm_ca'?'KBJM Canada':'智点未来 China'} · V{d.revision} · {d.effective_month} · {zh?'未生效':'Inactive'}</p>)}</details></main>;
}
