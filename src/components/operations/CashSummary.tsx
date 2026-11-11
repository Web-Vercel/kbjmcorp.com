import Link from 'next/link';
import {money,type Currency} from '@/lib/billing/model';
import {formatDate} from '@/lib/admin/content';
import type {Locale} from '@/lib/content';
export type CashWallet={id:string;currency:Currency;balance_minor:string;pending_notice_count:string;pending_notice_minor:string;pending_receipt_count:string;pending_receipt_minor:string;recent_entries:{id:string;kind:string;amount_minor:string;description:string;posted_at:string}[]};
export default function CashSummary({locale,wallets,error}:{locale:Locale;wallets:CashWallet[];error:boolean}){
 const zh=locale==='zh';
 if(error)return <p className="admin-error">{zh?'到账复核统计与最近流水暂不可用，请稍后重试。待复核款项状态尚未确认。':'Receipt statistics and recent entries are temporarily unavailable. Retry later. Pending receipt status is unconfirmed.'}</p>;
 return <section aria-label={zh?'付款通知与到账复核':'Payment notices and receipt review'}><p className="workflow-byline">{zh?'付款通知和到账制单是不同记录，不能相加作为充值额；待复核款项尚未计入余额。':'Payment notices and prepared receipts are separate records; do not add them as credits. Pending receipts are excluded from balance.'}</p>{wallets.map(w=><article className="admin-project" key={w.id}><dl className="admin-facts"><dt>{zh?'客户付款通知（待核对）':'Customer notices awaiting checks'}</dt><dd>{w.pending_notice_count} · {money(w.pending_notice_minor,w.currency,locale)}</dd><dt>{zh?'到账制单（待独立复核）':'Prepared receipts awaiting independent review'}</dt><dd>{w.pending_receipt_count} · {money(w.pending_receipt_minor,w.currency,locale)}</dd></dl><Link className="service-link" href={`/${locale}/operations/collections`}>{zh?'前往到账制单与复核':'Open receipt preparation and review'} ↗</Link><h3>{zh?'最近已入账流水（最多10条）':'Recent posted entries (up to 10)'}</h3>{!w.recent_entries.length?<p>{zh?'尚无已入账流水。':'No posted entries.'}</p>:w.recent_entries.map(e=><div key={e.id}><strong>{money(e.amount_minor,w.currency,locale)}</strong><p>{e.description} · {formatDate(e.posted_at,locale)}</p></div>)}</article>)}</section>;
}
