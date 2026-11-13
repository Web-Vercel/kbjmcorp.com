import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import {lastEndedFundsMonth,monthlyFundsSchema} from '@/lib/billing/monthly-funds';
import MonthlyFundsReport from '@/components/billing/MonthlyFundsReport';
export const dynamic='force-dynamic';
export const metadata={title:'客户资金对账（财务） | 智点未来',robots:{index:false,follow:false}};
export default async function Funds({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams,last=lastEndedFundsMonth(),month=query.month||last;
 if(query.company&&!z.uuid().safeParse(query.company).success)notFound();
 if(!/^\d{4}-\d{2}$/.test(month)||!z.iso.date().safeParse(month+'-01').success||month<'2000-01'||month>last)notFound();
 const orgResult=await client.from('organizations').select('id,name').order('name').limit(500);
 const parsedOrgs=z.array(z.object({id:z.uuid(),name:z.string()})).safeParse(orgResult.data);
 const orgError=!!orgResult.error||!parsedOrgs.success,orgs=!orgError&&parsedOrgs.success?parsedOrgs.data:[],company=query.company||orgs[0]?.id;
 if(query.company&&!orgError&&!orgs.some(o=>o.id===query.company))notFound();
 const result=company&&!orgError?await client.rpc('get_ops_monthly_funds',{p_org:company,p_month:month+'-01'}):null;
 const parsed=monthlyFundsSchema.safeParse(result?.data);const report=result&&!result.error&&parsed.success&&parsed.data.currency==='CNY'&&parsed.data.month===month+'-01'?parsed.data:null;
 const unavailable=orgError||!!result?.error||!!result&&result.data!==null&&!report;
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations/month-close?${new URLSearchParams({month,...(company?{company}:{})})}`}>← {zh?'月结工作台':'Month-close workbench'}</Link><h1>{zh?'客户资金对账（财务）':'Client funds reconciliation (finance)'}</h1><p className="admin-notice">{zh?'与客户月度资金对账单使用同一计算口径：America/Vancouver 入账月份，人民币资金账户。期初 + 入账 − 支出 = 期末。只查看已入账流水，不自动读取广告、不批准到账、不新增扣款。':'Uses the same calculation as the client funds report: America/Vancouver posting months and CNY wallets. Opening + credits − debits = closing. Reads posted entries only; does not collect ads, approve receipts or create charges.'}</p><p>{zh?'本页按入账月份核对，可能与广告结算月份不同。运营中心原有“北京时间月度资金摘要”仍供内部使用；月末跨时区入账可能归入不同月份，核对客户文件时请用本页。':'Posting month may differ from advertising settlement month. The original Beijing-month summary remains for internal use; entries near month-end can fall into different months. Use this page when comparing client files.'}</p>
 {!orgError&&orgs.length>0&&<form className="admin-filter"><label>{zh?'客户企业':'Client company'}<select name="company" defaultValue={company}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{zh?'入账月份':'Posting month'}<input name="month" type="month" min="2000-01" max={last} defaultValue={month} required/></label><button className="button">{zh?'查看客户资金对账':'View client funds reconciliation'}</button></form>}
 {unavailable?<p className="admin-error">{zh?'资金对账暂不可用，请稍后重试或核实财务权限。未知金额不显示为零。':'Funds reconciliation unavailable. Retry or check finance access. Unknown amounts are not zero.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:!report?<section className="admin-panel"><h2>{zh?'尚未开立人民币资金账户':'No CNY wallet has been opened'}</h2><p>{zh?'这不是余额为零或客户未付款的证明。请先核实企业资金账户与真实收款记录。':'This does not prove a zero balance or lack of payment. Verify the company wallet and actual receipt records.'}</p></section>:<MonthlyFundsReport report={report} locale={locale} scope="operations" company={company}/>}
 </main>;
}
