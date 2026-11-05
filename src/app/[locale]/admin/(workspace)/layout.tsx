import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { requireStaffPage } from "@/lib/admin/page";
export const dynamic="force-dynamic";
export const metadata={title:"业务管理中心 | 智点未来",robots:{index:false,follow:false}};
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();await requireStaffPage(locale);return <AdminShell locale={locale}>{children}</AdminShell>;}
