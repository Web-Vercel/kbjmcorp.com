import Link from "next/link";
import { notFound } from "next/navigation";
import StaffLogin from "@/components/admin/StaffLogin";
import { getStaffLoginConfig } from "@/lib/auth/config";
export const dynamic="force-dynamic";
export const metadata={title:"员工登录 | 智点未来联合办公",robots:{index:false,follow:false}};
export default async function Login({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();const config=getStaffLoginConfig();const zh=locale==="zh";
 return <main className="admin-auth"><Link className="admin-auth-brand" href={`/${locale}`}>智点未来</Link><h1>{zh?"员工登录":"Employee sign-in"}</h1><p><Link href={`/${locale}/access/login`}>{zh?"客户与合作伙伴登录 →":"Client and partner sign-in →"}</Link></p><StaffLogin locale={locale} enabled={Boolean(config)} siteKey={config?.siteKey||""}/></main>;
}
