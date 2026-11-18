import CollectionInstructions from '@/components/collections/CollectionInstructions';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
import {getLiveContext} from '@/lib/live-access/server';
import {loadBilling} from '@/lib/billing/data';
import {fundsKind} from '@/lib/billing/monthly-funds';
import {money} from '@/lib/billing/model';
import {formatDate} from '@/lib/admin/content';
export const dynamic='force-dynamic';
export const metadata={title:'账户余额与流水 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{wallet?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh',query=await searchParams;
 if(query.wallet&&!z.uuid().safeParse(query.wallet).success)notFound();
 const c=await getLiveContext();if('error'in c)redirect(`/${locale}/access/${c.error==='mfa_required'?'security':'login'}`);
 if(c.context.role!=='client')notFound();
 const data=await loadBilling(c.client);
 if(!data.error&&query.wallet&&!data.wallets.some(w=>w.id===query.wallet))notFound();
 const wallets=data.wallets.filter(w=>!query.wallet||w.id===query.wallet);
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/access`}>← {zh?'返回客户总览':'Back to client overview'}</Link><h1>{zh?'账户余额与最近流水':'Wallet balance and recent entries'}</h1>{data.error?<p role="alert">{zh?'资金记录暂不可用，请稍后重试。':'Fund records unavailable. Please retry later.'}</p>:<><CollectionInstructions client={c.client} locale={locale} wallets={wallets}/>{wallets.map(w=><section className="admin-panel" key={w.id}><h2 data-workspace-value>{w.organization_name} · {w.currency}</h2><h3>{zh?'已入账余额':'Posted balance'}</h3><p data-workspace-value>{money(w.balance_minor,w.currency,locale)}</p><p><Link className="service-link" href={`/${locale}/account/funds?wallet=${w.id}`}>{zh?'查看月度资金对账':'View monthly funds reconciliation'}</Link> · <Link className="service-link" href={`/${locale}/account/payment-notices?wallet=${w.id}`}>{zh?'查看付款通知':'View payment notices'}</Link></p><h3 id="transactions">{zh?'最近已入账流水':'Recent posted entries'}</h3>{data.entries.filter(e=>e.wallet_id===w.id).map(e=><article className="admin-project" key={e.id}><h3 data-workspace-value>{money(e.amount_minor,w.currency,locale)}</h3><p>{fundsKind(e.kind,zh)} · {formatDate(e.posted_at,locale)}</p><p>{e.description}</p>{e.statement_id&&<Link className="service-link" href={`/${locale}/account/statements?wallet=${w.id}&statement=${e.statement_id}`}>{zh?'查看关联账单':'View linked statement'}</Link>}</article>)}{!data.entries.some(e=>e.wallet_id===w.id)&&<p>{zh?'暂无已入账流水。':'No posted entries.'}</p>}<details><summary>{zh?'历史月报':'Historical reports'}</summary>{data.reports?.filter(r=>r.wallet_id===w.id).map(r=><p key={r.id}><Link className="service-link" href={`/${locale}/account/reports/${r.id}`}>{r.month.slice(0,7)} · {r.source_filename}</Link></p>)}{!data.reports?.some(r=>r.wallet_id===w.id)&&<p>{zh?'暂无历史月报。':'No historical reports.'}</p>}</details></section>)}{!wallets.length&&<p>{zh?'暂无可访问的资金账户。':'No accessible wallet.'}</p>}</>}</main>;
}
