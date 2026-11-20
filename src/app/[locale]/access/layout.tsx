import ExternalIdentityBar from '@/components/session/ExternalIdentityBar';
import WorkspacePresentation from '@/components/WorkspacePresentation';
import BusinessNavigation from '@/components/BusinessNavigation';
import InvestorShell from '@/components/live-access/InvestorShell';
import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {getLiveContext} from '@/lib/live-access/server';
export const dynamic='force-dynamic';
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const account=await getLiveContext();
 if(!('error'in account)&&account.context.role==='investor')return <WorkspacePresentation userId={account.user.id} email={account.user.email}><Suspense fallback={null}><InvestorShell locale={locale} email={account.user.email} label={account.context.label} company={account.context.organization_name}>{children}</InvestorShell></Suspense></WorkspacePresentation>;
 return <WorkspacePresentation userId={'error'in account?undefined:account.user.id} email={'error'in account?undefined:account.user.email}>{!('error'in account)&&<ExternalIdentityBar locale={locale} email={account.user.email} label={account.context.label} role={account.context.role} company={account.context.organization_name}/>}<BusinessNavigation locale={locale} section="access" role={'error' in account?undefined:account.context.role}/>{children}</WorkspacePresentation>;
}
