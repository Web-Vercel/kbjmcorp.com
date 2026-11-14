import BusinessNavigation from '@/components/BusinessNavigation';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
import {notFound} from 'next/navigation';
import {requireOperations} from '@/lib/operations/server';
import StaffIdentityBar from '@/components/admin/StaffIdentityBar';
export const dynamic='force-dynamic';
export default async function OperationsLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const staff=await requireOperations(locale);
 const acceptance=collectionTestOrganization();
 return <><StaffIdentityBar locale={locale} email={staff.user.email} role={staff.role} context={staff.context}/>{acceptance&&<aside className="admin-notice" style={{margin:'1rem'}} role="note">{locale==='zh'?'财务流程验收：仅使用专用测试企业及不可付款收款资料，不实际收付款。真实广告来源仅作核对；测试余额、流水与账单不得迁入正式账本。':'Financial acceptance: use the dedicated test company and nonpayable collection details only. Do not make actual payments. Real advertising sources are for verification; never migrate test balances, entries or statements into the live ledger.'}</aside>}<BusinessNavigation locale={locale} section="operations"/>{children}</>;
}
