import Link from "next/link";
import { notFound } from "next/navigation";
import StaffLogin from "@/components/admin/StaffLogin";
import { getStaffLoginConfig } from "@/lib/auth/config";
export const dynamic="force-dynamic";
export const metadata={title:"内部登录 | 智点未来",robots:{index:false,follow:false}};
export default async function Login({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();const config=getStaffLoginConfig();const zh=locale==="zh";
 return <main className="admin-auth"><Link className="admin-auth-brand" href={`/${locale}`}>智点未来</Link><h1>{zh?"内部管理登录":"Staff workspace sign-in"}</h1><p>{zh?"管理员与客户权限分开，业务数据需二次验证后访问。":"Staff and client permissions are separate. Business data requires two-factor verification."}</p><StaffLogin locale={locale} enabled={Boolean(config)} siteKey={config?.siteKey||""}/><Link className="admin-preview-link" href={`/${locale}/admin-preview`}>{zh?"查看模拟后台预览":"Explore fictional workspace preview"} ↗</Link></main>;
}
