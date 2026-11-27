import CashSummary from '@/components/operations/CashSummary';
import FundsQuery from '@/components/operations/FundsQuery';
import {money} from '@/lib/billing/model';
import {operationsMenuLabel} from '@/lib/operations/navigation';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import {lastEndedFundsMonth,monthlyFundsSchema} from '@/lib/billing/monthly-funds';
import MonthlyFundsReport from '@/components/billing/MonthlyFundsReport';
export const dynamic='force-dynamic';
export const metadata={title:'资金查询 | 智点未来',robots:{index:false,follow:false}};
export default async function Funds({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string;view?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams,last=lastEndedFundsMonth(),month=query.month||last,monthly=query.view==='monthly'||(!query.view&&!!query.month);
 if(query.view&&!['current','monthly'].includes(query.view))notFound();
 if(query.company&&!z.uuid().safeParse(query.company).success)notFound();
 if(monthly&&(!/^\d{4}-\d{2}$/.test(month)||!z.iso.date().safeParse(month+'-01').success||month<'2000-01'||month>last))notFound();
 const orgResult=await client.from('organizations').select('id,name').order('name').limit(500);
 const parsedOrgs=z.array(z.object({id:z.uuid(),name:z.string()})).safeParse(orgResult.data);
 const orgError=!!orgResult.error||!parsedOrgs.success,orgs=!orgError&&parsedOrgs.success?parsedOrgs.data:[],company=query.company||orgs[0]?.id;
 if(query.company&&!orgError&&!orgs.some(o=>o.id===query.company))notFound();
 const result=monthly&&company&&!orgError?await client.rpc('get_ops_monthly_funds',{p_org:company,p_month:month+'-01'}):null;
 const parsed=monthlyFundsSchema.safeParse(result?.data);const report=result&&!result.error&&parsed.success&&parsed.data.currency==='CNY'&&parsed.data.month===month+'-01'?parsed.data:null;
 const unavailable=orgError||!!result?.error||!!result&&result.data!==null&&!report;
 const cashResult=!monthly&&company&&!orgError?await client.rpc('get_ops_cash_summary',{p_org:company}):null;
 const minor=z.string().regex(/^-?\d{1,20}$/),count=z.string().regex(/^\d+$/);
 const cashParsed=z.array(z.object({id:z.uuid(),currency:z.enum(['CNY','CAD','USD','EUR','GBP','AUD']),balance_minor:minor,pending_notice_count:count,pending_notice_minor:minor,pending_receipt_count:count,pending_receipt_minor:minor,recent_entries:z.array(z.object({id:z.uuid(),kind:z.string(),amount_minor:minor,description:z.string(),posted_at:z.string()})).max(10)})).safeParse(cashResult?.data);
 const cashError=orgError||!!cashResult?.error||!!cashResult&&!cashParsed.success;
 const wallets=cashParsed.success?cashParsed.data:[];
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations/month-close?${new URLSearchParams({month,...(company?{company}:{})})}`}>← {zh?'月结工作台':'Month-close workbench'}</Link><h1>{operationsMenuLabel('funds',['资金查询','Fund records'],context,locale)}</h1>{monthly&&<p className="admin-notice">{zh?'本页仅查询已结束的温哥华自然月，当月结束后才可选择。期初＋入账－支出＝期末；历史期末不是当前余额，入账月份可能与广告账单不同。':'Only ended Vancouver calendar months are available here; the current month becomes available after month-end. Opening + credits − debits = closing. Historical closing is not the current balance; posting and advertising months may differ.'}</p>}<details><summary>{zh?'查看办理说明':'Workflow guidance'}</summary><p className="admin-notice">{zh?'与客户月度资金对账单使用同一计算口径：America/Vancouver 入账月份，人民币资金账户。期初 + 入账 − 支出 = 期末。只查看已入账流水，不自动读取广告、不批准到账、不新增扣款。':'Uses the same calculation as the client funds report: America/Vancouver posting months and CNY wallets. Opening + credits − debits = closing. Reads posted entries only; does not collect ads, approve receipts or create charges.'}</p><p>{zh?'本页按入账月份核对，可能与广告结算月份不同。运营中心原有“北京时间月度资金摘要”仍供内部使用；月末跨时区入账可能归入不同月份，核对客户文件时请用本页。':'Posting month may differ from advertising settlement month. The original Beijing-month summary remains for internal use; entries near month-end can fall into different months. Use this page when comparing client files.'}</p></details>
 {!orgError&&orgs.length>0&&<FundsQuery key={`${company}:${month}:${monthly}`} locale={locale} organizations={orgs} company={company!} month={month<=last?month:last} lastMonth={last} monthly={monthly}/>}
 {!monthly&&(cashError?<p className="admin-error">{zh?'当前资金记录暂不可用，不能据此认定余额为零或尚未开户。':'Current fund records unavailable; do not infer a zero balance or missing wallet.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:<section className="admin-panel"><h2 data-workspace-value>{orgs.find(o=>o.id===company)?.name}</h2><h3>{zh?'当前余额与最近流水':'Current balance and recent transactions'}</h3>{!wallets.length?<p>{zh?'尚未开立人民币资金账户。':'No CNY wallet has been opened.'}</p>:wallets.map(w=><p key={w.id}>{zh?'当前账面余额：':'Current posted balance: '}<strong data-workspace-value>{money(w.balance_minor,w.currency,locale)}</strong></p>)}{wallets.length>0&&<CashSummary locale={locale} wallets={wallets} error={false}/>}</section>)}
 {monthly&&<>
 {unavailable?<p className="admin-error">{zh?'资金对账暂不可用，请稍后重试或核实财务权限。未知金额不显示为零。':'Funds reconciliation unavailable. Retry or check finance access. Unknown amounts are not zero.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:!report?<section className="admin-panel"><h2>{zh?'尚未开立人民币资金账户':'No CNY wallet has been opened'}</h2><p>{zh?'这不是余额为零或客户未付款的证明。请先核实企业资金账户与真实收款记录。':'This does not prove a zero balance or lack of payment. Verify the company wallet and actual receipt records.'}</p></section>:<MonthlyFundsReport report={report} locale={locale} scope="operations" company={company}/>}
 </>}
 </main>;
}
