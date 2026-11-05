import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignOutButton from "@/components/SignOutButton";
import { authClient } from "@/lib/auth/server";
import { maskPhone } from "@/lib/auth/validation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "客户中心 | KBJM", robots: { index: false, follow: false } };
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();
  const zh = locale === "zh";
  const client = await authClient();
  if (!client) redirect(`/${locale}/login`);
  const result = await client.auth.getUser().catch(() => null);
  if (!result?.data.user || result.error) redirect(`/${locale}/login`);
  // Use the signed-in user's client and RLS, never a service-role read.
  const { data, error } = await client.from("organizations").select("id,name").order("created_at", { ascending: true });
  return <><SiteHeader locale={locale} path="/account" /><main id="main" className="section wrap account-page"><p className="eyebrow">{zh ? "客户中心" : "CLIENT CENTER"}</p><h1>{zh ? "欢迎回来" : "Welcome back"}</h1><p>{maskPhone(result.data.user.phone)}</p>
    {error ? <section className="account-panel"><h2>{zh ? "暂时无法读取客户信息" : "Client information is unavailable"}</h2><p>{zh ? "请稍后重试，当前不会展示任何公司数据。" : "Please try again later. No organization data is displayed."}</p></section> : !data?.length ? <section className="account-panel"><h2>{zh ? "等待关联客户公司" : "Organization association pending"}</h2><p>{zh ? "您的手机号已验证。完成公司身份核验与权限分配后，即可访问所属公司的客户服务。请通过原有业务对接渠道联系 KBJM。" : "Your phone is verified. Access to client services follows organization verification and permission assignment. Contact KBJM through your existing business contact."}</p></section> : <section className="account-panel"><h2>{zh ? "您的客户公司" : "Your organizations"}</h2><ul>{data.map(org => <li key={org.id}>{org.name}</li>)}</ul><p>{zh ? "广告报表与项目看板正在开发中。" : "Advertising reports and project dashboards are in development."}</p></section>}
    <SignOutButton locale={locale} /></main><SiteFooter locale={locale} /></>;
}
