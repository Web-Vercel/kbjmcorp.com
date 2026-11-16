import Link from "next/link";
import { notFound } from "next/navigation";
import StaffLogin from "@/components/admin/StaffLogin";
import { getStaffLoginConfig } from "@/lib/auth/config";
export const dynamic="force-dynamic";
export const metadata={title:"员工登录 | 智点未来联合办公",robots:{index:false,follow:false}};
export default async function Login({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();const config=getStaffLoginConfig();const zh=locale==="zh";
 return <main className="admin-auth"><Link className="admin-auth-brand" href={`/${locale}`}>智点未来</Link><h1>{zh?"员工登录":"Employee sign-in"}</h1><p>{zh?"智点未来联合办公 · 加拿大与中国内部员工使用。登录后按职责进入业务管理中心，并完成验证器二次验证。":"Joint Canada–China employee workspace. Sign in to business management with role-based access and authenticator verification."}</p><p><Link href={`/${locale}/access/login`}>{zh?"客户与合作伙伴登录 →":"Client and partner sign-in →"}</Link></p><StaffLogin locale={locale} enabled={Boolean(config)} siteKey={config?.siteKey||""}/>{process.env.VERCEL_ENV!=="production"&&<Link className="admin-preview-link" href={`/${locale}/admin-preview`}>{zh?"查看模拟后台预览":"Explore fictional workspace preview"} ↗</Link>}</main>;
}
