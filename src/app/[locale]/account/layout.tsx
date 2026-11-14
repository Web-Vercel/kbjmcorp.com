import WorkspacePresentation from '@/components/WorkspacePresentation';
import BusinessNavigation from '@/components/BusinessNavigation';
import {notFound} from 'next/navigation';
import {getLiveContext} from '@/lib/live-access/server';
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const account=await getLiveContext();
 return <WorkspacePresentation><BusinessNavigation locale={locale} section="account" role={'error' in account?undefined:account.context.role}/>{children}</WorkspacePresentation>;
}
