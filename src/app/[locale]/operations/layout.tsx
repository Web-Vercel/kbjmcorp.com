import {notFound} from 'next/navigation';
import {requireOperations} from '@/lib/operations/server';
import StaffIdentityBar from '@/components/admin/StaffIdentityBar';
export const dynamic='force-dynamic';
export default async function OperationsLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const staff=await requireOperations(locale);
 return <><StaffIdentityBar locale={locale} email={staff.user.email} role={staff.role} context={staff.context}/>{children}</>;
}
