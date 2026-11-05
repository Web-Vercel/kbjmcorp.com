import { notFound,redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/guard";
import StaffMfa from "@/components/admin/StaffMfa";
export const dynamic="force-dynamic";
export const metadata={title:"二次验证 | 智点未来",robots:{index:false,follow:false}};
export default async function Security({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="zh"&&locale!=="en")notFound();const staff=await getStaffContext(false);if("error"in staff)redirect(`/${locale}/admin/login`);const assurance=await staff.client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.data?.currentLevel==="aal2")redirect(`/${locale}/admin`);const {data,error}=await staff.client.auth.mfa.listFactors();const zh=locale==="zh";
 return <main className="admin-auth"><p className="eyebrow">{zh?"内部账号安全":"STAFF ACCOUNT SECURITY"}</p><h1>{zh?"验证您的身份":"Verify your identity"}</h1><p>{zh?"使用验证器动态验证码访问客户业务数据。":"Use an authenticator code to access client business data."}</p>{error?<p role="alert">{zh?"暂时无法读取验证器设置，请稍后重试。":"Authenticator settings are unavailable. Try later."}</p>:<StaffMfa locale={locale} verifiedFactorId={data.totp.find(f=>f.status==="verified")?.id}/>}</main>;
}
