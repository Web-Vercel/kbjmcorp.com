import WorkspacePresentation from '@/components/WorkspacePresentation';
import ExternalIdentityBar from '@/components/session/ExternalIdentityBar';
import {getLiveContext} from '@/lib/live-access/server';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const account=await getLiveContext();
 return <WorkspacePresentation userId={'error'in account?undefined:account.user.id} email={'error'in account?undefined:account.user.email}>{!('error'in account)&&<ExternalIdentityBar locale={locale} email={account.user.email} label={account.context.label} role={account.context.role} company={account.context.organization_name}/>} {children}</WorkspacePresentation>;
}
