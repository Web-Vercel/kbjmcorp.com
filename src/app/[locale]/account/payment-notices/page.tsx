import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
import {getLiveContext} from '@/lib/live-access/server';
import {loadBilling} from '@/lib/billing/data';
import {money} from '@/lib/billing/model';
import {formatDate} from '@/lib/admin/content';
export const dynamic='force-dynamic';
export const metadata={title:'付款通知记录 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{wallet?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh',query=await searchParams;
 if(query.wallet&&!z.uuid().safeParse(query.wallet).success)notFound();
 const c=await getLiveContext();if('error'in c)redirect(`/${locale}/access/${c.error==='mfa_required'?'security':'login'}`);
 if(c.context.role!=='client')notFound();
 const data=await loadBilling(c.client);
 if(!data.error&&query.wallet&&!data.wallets.some(w=>w.id===query.wallet))notFound();
 const wallets=data.wallets.filter(w=>!query.wallet||w.id===query.wallet);
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/access`}>← {zh?'返回客户总览':'Back to client overview'}</Link><h1>{zh?'已保存的付款通知':'Saved payment notices'}</h1><p>{zh?'付款通知需经财务核实到账后入账。':'Payment notices require finance receipt verification before funds are credited.'}</p>{data.error?<p role="alert">{zh?'付款通知暂不可用，请稍后重试。':'Payment notices unavailable. Please retry later.'}</p>:<section id="payment-notices">{wallets.map(w=>{const notices=data.topups.filter(t=>t.wallet_id===w.id);return <section className="admin-panel" key={w.id}><h2 data-workspace-value>{w.organization_name} · {w.currency}</h2>{notices.length?notices.map(t=><article className="admin-project" key={t.id} id={`topup-${t.id}`}><h3 data-workspace-value>{money(t.amount_minor,w.currency,locale)}</h3><p>{t.status==='pending'?(zh?'待财务核对':'Awaiting finance verification'):t.status==='credited'?(zh?'已入账':'Credited'):(zh?'未通过核对':'Not verified')}</p><p data-workspace-value>{t.reference}</p><p>{formatDate(t.created_at,locale)}</p></article>):<p>{zh?'暂无已保存的付款通知。':'No saved payment notices.'}</p>}</section>})}{!wallets.length&&<p>{zh?'暂无可访问的资金账户。':'No accessible wallet.'}</p>}</section>}</main>;
}
