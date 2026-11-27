import OperationsAcceptanceNotice from '@/components/operations/OperationsAcceptanceNotice';
import {Suspense} from 'react';
import WorkflowNavigation from '@/components/operations/WorkflowNavigation';
import WorkspacePresentation from '@/components/WorkspacePresentation';
import AdminShell from '@/components/admin/AdminShell';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
import {notFound} from 'next/navigation';
import {requireOperations} from '@/lib/operations/server';
import StaffIdentityBar from '@/components/admin/StaffIdentityBar';
export const dynamic='force-dynamic';
export default async function OperationsLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const staff=await requireOperations(locale);
 const adminAccess=await staff.client.rpc('has_staff_access');
 const canAdminWorkspace=!adminAccess.error&&adminAccess.data===true;
 const acceptance=collectionTestOrganization();
 return <WorkspacePresentation userId={staff.user.id} email={staff.user.email}><AdminShell locale={locale} staffRole={staff.role} operationsContext={staff.context} canManage={canAdminWorkspace} operations identity={<StaffIdentityBar locale={locale} email={staff.user.email} role={staff.role} context={staff.context}/>}>{acceptance&&<OperationsAcceptanceNotice locale={locale}/>}<Suspense fallback={null}><WorkflowNavigation locale={locale} context={staff.context}/></Suspense>{children}</AdminShell></WorkspacePresentation>;
}
