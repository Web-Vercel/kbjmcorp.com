import {getLiveContext} from '@/lib/live-access/server';
import {redirect} from 'next/navigation';
import {notFound} from 'next/navigation';
import RefundWorkspace from '@/components/partners/RefundWorkspace';
export const dynamic='force-dynamic';export const metadata={title:'余额退款 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const account=await getLiveContext();if('error' in account)redirect(`/${locale}/access/${account.error==='mfa_required'?'security':'login'}`);if(account.context.role!=='client')redirect(`/${locale}/access`);return <RefundWorkspace client={account.client} locale={locale}/>;}
