import {authClient} from '@/lib/auth/server';
import {redirect} from 'next/navigation';
import {notFound} from 'next/navigation';
import RefundWorkspace from '@/components/partners/RefundWorkspace';
export const dynamic='force-dynamic';export const metadata={title:'余额退款 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const client=await authClient();if(!client)redirect(`/${locale}/access/login`);const user=await client.auth.getUser();if(!user.data.user)redirect(`/${locale}/access/login`);const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.data?.currentLevel!=='aal2')redirect(`/${locale}/access/security`);return <RefundWorkspace client={client} locale={locale}/>;}
