import {z} from 'zod';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireClientPage} from '@/lib/client/page';
import {lastEndedFundsMonth,monthlyFundsSchema} from '@/lib/billing/monthly-funds';
import MonthlyFundsReport from '@/components/billing/MonthlyFundsReport';
export const dynamic='force-dynamic';
export const metadata={title:'月度资金对账单 | 智点未来',robots:{index:false,follow:false}};
export default async function Funds({params,searchParams}:{params:Promise<{locale:string}>;searchParams?:Promise<{wallet?:string;month?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh',query=await searchParams||{},last=lastEndedFundsMonth(),month=query.month||last;
 if(query.wallet&&!z.uuid().safeParse(query.wallet).success)notFound();
 if(!/^\d{4}-\d{2}$/.test(month)||!z.iso.date().safeParse(month+'-01').success||month<'2000-01'||month>last)notFound();
 const returnPath=`/${locale}/account/funds?${new URLSearchParams({...query.wallet?{wallet:query.wallet}:{},month})}`;
 const {client}=await requireClientPage(locale,returnPath);const walletResult=await client.rpc('get_client_wallets');const parsedWallets=z.array(z.object({id:z.uuid(),organization_name:z.string(),currency:z.string()})).safeParse(walletResult.data);
 const unavailable=!!walletResult.error||!parsedWallets.success;const wallets=!unavailable&&parsedWallets.success?parsedWallets.data:[];
 if(query.wallet&&!unavailable&&!wallets.some(w=>w.id===query.wallet))notFound();
 const wallet=query.wallet||wallets[0]?.id;
 const result=!unavailable&&wallet?await client.rpc('get_client_monthly_funds',{p_wallet:wallet,p_month:month+'-01'}):null;
 const parsed=monthlyFundsSchema.safeParse(result?.data);const report=result&&!result.error&&parsed.success&&parsed.data.wallet_id===wallet&&parsed.data.month===month+'-01'?parsed.data:null;
 return <><main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/account${wallet?'?wallet='+wallet:''}#transactions`}>← {zh?'返回账户余额与流水':'Back to wallet and entries'}</Link><h1>{zh?'月度资金对账单':'Monthly funds reconciliation'}</h1><p className="admin-notice">{zh?'按 America/Vancouver 入账日期统计已结束自然月。期初余额 + 当月入账 − 当月支出 = 期末余额。仅包含已入账资金，不包含待核对付款或尚未扣除的广告费用；期末余额不是当前余额。':'Ended calendar months based on posting dates in America/Vancouver. Opening balance + credits − debits = closing balance. Includes posted funds only, excluding pending payments and unposted advertising costs. Closing balance is not the current balance.'}</p>
 {!unavailable&&wallets.length>0&&<form className="admin-filter"><label>{zh?'资金账户':'Wallet'}<select name="wallet" defaultValue={wallet}>{wallets.map(w=><option key={w.id} value={w.id}>{w.organization_name} · {w.currency}</option>)}</select></label><label>{zh?'入账月份':'Posting month'}<input type="month" name="month" min="2000-01" max={last} defaultValue={month} required/></label><button className="button">{zh?'查看资金对账单':'View funds reconciliation'}</button></form>}
 {unavailable?<p className="admin-error">{zh?'资金账户暂不可用，不能据此认定余额为零。':'Wallets unavailable; do not infer zero balances.'}</p>:!wallet?<p>{zh?'暂无已授权资金账户，请联系业务人员开通财务查看权限。':'No authorized wallets. Contact your representative for finance access.'}</p>:!report?<p className="admin-error">{zh?'资金对账单暂不可用，未将未知金额显示为零。请稍后重试或联系业务人员。':'Funds reconciliation unavailable. Unknown amounts are not shown as zero. Retry later or contact your representative.'}</p>:<MonthlyFundsReport report={report} locale={locale}/>}
 </main></>;
}
