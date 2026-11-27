import MonthlyCash from '@/components/operations/MonthlyCash';
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
export default async function Funds({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string;view?:string;basis?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams,beijing=query.basis==='beijing',todayBeijing=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date()),last=lastEndedFundsMonth(),month=query.month||(beijing?todayBeijing:last),monthly=query.view==='monthly'||(!query.view&&!!query.month);
 if(query.basis&&!['beijing','vancouver'].includes(query.basis))notFound();
 if(query.view&&!['current','monthly'].includes(query.view))notFound();
 if(query.company&&!z.uuid().safeParse(query.company).success)notFound();
 if(monthly&&(!/^\d{4}-\d{2}$/.test(month)||!z.iso.date().safeParse(month+'-01').success||month<'2000-01'||month>(beijing?todayBeijing:last)))notFound();
 const orgResult=await client.from('organizations').select('id,name').order('name').limit(500);
 const parsedOrgs=z.array(z.object({id:z.uuid(),name:z.string()})).safeParse(orgResult.data);
 const orgError=!!orgResult.error||!parsedOrgs.success,orgs=!orgError&&parsedOrgs.success?parsedOrgs.data:[],company=query.company||orgs[0]?.id;
 if(query.company&&!orgError&&!orgs.some(o=>o.id===query.company))notFound();
 const result=monthly&&!beijing&&company&&!orgError?await client.rpc('get_ops_monthly_funds',{p_org:company,p_month:month+'-01'}):null;
 const parsed=monthlyFundsSchema.safeParse(result?.data);const report=result&&!result.error&&parsed.success&&parsed.data.currency==='CNY'&&parsed.data.month===month+'-01'?parsed.data:null;
 const unavailable=orgError||!!result?.error||!!result&&result.data!==null&&!report;
 const cashResult=!monthly&&company&&!orgError?await client.rpc('get_ops_cash_summary',{p_org:company}):null;
 const minor=z.string().regex(/^-?\d{1,20}$/),count=z.string().regex(/^\d+$/);
 const cashParsed=z.array(z.object({id:z.uuid(),currency:z.enum(['CNY','CAD','USD','EUR','GBP','AUD']),balance_minor:minor,pending_notice_count:count,pending_notice_minor:minor,pending_receipt_count:count,pending_receipt_minor:minor,recent_entries:z.array(z.object({id:z.uuid(),kind:z.string(),amount_minor:minor,description:z.string(),posted_at:z.string()})).max(10)})).safeParse(cashResult?.data);
 const cashError=orgError||!!cashResult?.error||!!cashResult&&!cashParsed.success;
 const wallets=cashParsed.success?cashParsed.data:[];
 const summaryResult=monthly&&beijing&&company&&!orgError?await client.rpc('get_ops_monthly_cash',{p_org:company,p_month:month+'-01'}):null;
 const summaryParsed=z.array(z.object({id:z.uuid(),currency:z.enum(['CNY','CAD','USD','EUR','GBP','AUD']),month:z.literal(month+'-01'),timezone:z.literal('Asia/Shanghai'),opening_minor:minor,topup_minor:minor,ad_spend_minor:minor,service_fee_minor:minor,refund_minor:minor,adjustment_minor:minor,closing_minor:minor,entry_count:count,as_of:z.string()})).safeParse(summaryResult?.data);
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/operations/month-close?${new URLSearchParams({month,...(company?{company}:{})})}`}>← {zh?'月结工作台':'Month-close workbench'}</Link><h1>{operationsMenuLabel('funds',['资金查询','Fund records'],context,locale)}</h1>{monthly&&!beijing&&<p className="admin-notice">{zh?'本页仅查询已结束的温哥华自然月，当月结束后才可选择。期初＋入账－支出＝期末；历史期末不是当前余额，入账月份可能与广告账单不同。':'Only ended Vancouver calendar months are available here; the current month becomes available after month-end. Opening + credits − debits = closing. Historical closing is not the current balance; posting and advertising months may differ.'}</p>}<details><summary>{zh?'查看办理说明':'Workflow guidance'}</summary><p>{zh?'当前余额由全部已入账流水计算，不受月份筛选影响。月度汇总使用同一批流水；温哥华口径用于客户对账，北京口径用于内部汇总。历史期末余额不代表当前余额。':'Current balance uses all posted entries independently of the month filter. Monthly views use the same ledger: Vancouver months for client reconciliation, Beijing months for internal summaries. Historical closing balances are not current balances.'}</p></details>
 {!orgError&&orgs.length>0&&<FundsQuery key={`${company}:${month}:${monthly}:${beijing}`} locale={locale} organizations={orgs} company={company!} month={month<=(beijing?todayBeijing:last)?month:last} lastMonth={last} currentMonth={todayBeijing} basis={beijing?'beijing':'vancouver'} monthly={monthly}/>}
 {!monthly&&(cashError?<p className="admin-error">{zh?'当前资金记录暂不可用，不能据此认定余额为零或尚未开户。':'Current fund records unavailable; do not infer a zero balance or missing wallet.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:<section className="admin-panel"><h2 data-workspace-value>{orgs.find(o=>o.id===company)?.name}</h2><h3>{zh?'当前余额与最近流水':'Current balance and recent transactions'}</h3>{!wallets.length?<p>{zh?'尚未开立人民币资金账户。':'No CNY wallet has been opened.'}</p>:wallets.map(w=><p key={w.id}>{zh?'当前账面余额：':'Current posted balance: '}<strong data-workspace-value>{money(w.balance_minor,w.currency,locale)}</strong></p>)}{wallets.length>0&&<CashSummary locale={locale} wallets={wallets} error={false}/>}</section>)}
 {monthly&&<details className="admin-panel" open><summary>{zh?'月度汇总与对账':'Monthly summary and reconciliation'} · {month} · {beijing?(zh?'北京时间':'Beijing time'):(zh?'温哥华时间':'Vancouver time')}</summary><h2 data-workspace-value>{orgs.find(o=>o.id===company)?.name}</h2>{beijing?(summaryResult?.error||!summaryParsed.success?<p className="admin-error">{zh?'月度资金摘要暂不可用，未知金额不显示为零。':'Monthly summary unavailable; unknown amounts are not zero.'}</p>:!summaryParsed.data.length?<p>{zh?'尚未开立资金账户。':'No wallet has been opened.'}</p>:<MonthlyCash locale={locale} wallets={summaryParsed.data} error={false}/>):<>
 {unavailable?<p className="admin-error">{zh?'资金对账暂不可用，请稍后重试或核实财务权限。未知金额不显示为零。':'Funds reconciliation unavailable. Retry or check finance access. Unknown amounts are not zero.'}</p>:!company?<p>{zh?'暂无可访问的客户企业。':'No accessible client company.'}</p>:!report?<section className="admin-panel"><h2>{zh?'尚未开立人民币资金账户':'No CNY wallet has been opened'}</h2><p>{zh?'这不是余额为零或客户未付款的证明。请先核实企业资金账户与真实收款记录。':'This does not prove a zero balance or lack of payment. Verify the company wallet and actual receipt records.'}</p></section>:<MonthlyFundsReport report={report} locale={locale} scope="operations" company={company}/>}
 </>}</details>}
 </main>;
}
