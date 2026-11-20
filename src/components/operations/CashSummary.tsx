import RecordPicker from '@/components/workspace/RecordPicker';
import Link from 'next/link';
import styles from './CashSummary.module.css';
import {money,type Currency} from '@/lib/billing/model';
import {formatDate} from '@/lib/admin/content';
import type {Locale} from '@/lib/content';
export type CashWallet={id:string;currency:Currency;balance_minor:string;pending_notice_count:string;pending_notice_minor:string;pending_receipt_count:string;pending_receipt_minor:string;recent_entries:{id:string;kind:string;amount_minor:string;description:string;posted_at:string}[]};
export default function CashSummary({locale,wallets,error}:{locale:Locale;wallets:CashWallet[];error:boolean}){
 const zh=locale==='zh';
 if(error)return <p className="admin-error">{zh?'到账复核统计与最近流水暂不可用，请稍后重试。待复核款项状态尚未确认。':'Receipt statistics and recent entries are temporarily unavailable. Retry later. Pending receipt status is unconfirmed.'}</p>;
 const labels:Record<string,string>=zh?{topup:'充值入账',ad_spend:'广告费用',service_fee:'服务及其他费用',refund:'退款支出',adjustment:'账务调整'}:{topup:'Top-up',ad_spend:'Advertising costs',service_fee:'Service and other fees',refund:'Refund',adjustment:'Adjustment'};
 return <section aria-label={zh?'付款通知与到账复核':'Payment notices and receipt review'}>
 <p className="workflow-byline">{zh?'待处理款项未计入余额；付款通知与到账制单不可相加。':'Pending funds are excluded from balance. Do not add notices and prepared receipts.'}</p>
 {<RecordPicker appearance="account" label={locale==='zh'?'选择到账资金账户':'Select Receipt wallet'} locale={locale} hashPrefix="cash-wallet-" items={wallets.map((w)=>({id:w.id,label:w.currency+' · '+w.id.slice(-8),active:false,content:<article className="admin-project" key={w.id}>
 <dl className={styles.metrics}>
 <div><dt>{zh?'付款通知 · 待核对':'Payment notices · awaiting checks'}</dt><dd data-workspace-value>{money(w.pending_notice_minor,w.currency,locale)} <small>{w.pending_notice_count}{zh?' 笔':' entries'}</small></dd></div>
 <div><dt>{zh?'到账制单 · 待独立复核':'Prepared receipts · awaiting independent review'}</dt><dd data-workspace-value>{money(w.pending_receipt_minor,w.currency,locale)} <small>{w.pending_receipt_count}{zh?' 笔':' entries'}</small></dd></div>
 </dl>
 <Link className="service-link" href={`/${locale}/operations/collections`}>{zh?'前往到账制单与复核':'Open receipt preparation and review'} ↗</Link>
 <h3>{zh?'最近已入账流水（最多10条）':'Recent posted entries (up to 10)'}</h3>
 {!w.recent_entries.length?<p>{zh?'尚无已入账流水。':'No posted entries.'}</p>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{zh?'入账时间':'Posted'}</th><th>{zh?'类型与说明':'Type and description'}</th><th>{zh?'金额':'Amount'}</th></tr></thead><tbody>{w.recent_entries.map(e=><tr key={e.id}><td data-workspace-value>{formatDate(e.posted_at,locale)}</td><td>{labels[e.kind]||e.kind}<details><summary>{zh?'原始说明':'Original description'}</summary><p>{e.description}</p></details></td><td data-workspace-value>{money(e.amount_minor,w.currency,locale)}</td></tr>)}</tbody></table></div>}
 </article>}))}/>}</section>;
}
