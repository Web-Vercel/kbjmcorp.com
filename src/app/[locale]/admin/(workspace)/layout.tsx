import { notFound } from "next/navigation";
import StaffIdentityBar from "@/components/admin/StaffIdentityBar";
import type {OpsContext} from "@/lib/operations/model";
import AdminShell from "@/components/admin/AdminShell";
import { requireStaffPage } from "@/lib/admin/page";
export const dynamic="force-dynamic";
export const metadata={title:"业务管理中心 | 智点未来",robots:{index:false,follow:false}};
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();const staff=await requireStaffPage(locale);const ops=await staff.client.rpc("get_ops_context");return <AdminShell locale={locale} identity={<StaffIdentityBar locale={locale} email={staff.user.email} role={staff.role} context={ops.error?null:ops.data as OpsContext}/>}>{children}</AdminShell>;}
