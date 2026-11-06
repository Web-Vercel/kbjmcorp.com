import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignOutButton from "@/components/SignOutButton";
import ClientWorkspace from "@/components/client/ClientWorkspace";
import { requireClientPage } from "@/lib/client/page";
import { loadClientWorkspace } from "@/lib/client/data";
import { maskPhone } from "@/lib/auth/validation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "客户中心 | 智点未来", robots: { index: false, follow: false } };
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params;
 if (locale !== "zh" && locale !== "en") notFound();
 const { client, user } = await requireClientPage(locale);
 const workspace = await loadClientWorkspace(client, user.id);
 return <><SiteHeader locale={locale} path="/account"/><main id="main" className="section wrap client-workspace"><p className="eyebrow">{locale === "zh" ? "客户中心" : "CLIENT CENTER"}</p><h1>{locale === "zh" ? "您的品牌，进展清晰可见。" : "Your brand. Clear progress."}</h1><p>{maskPhone(user.phone)}</p><details className="client-identity"><summary>{locale === "zh" ? "公司关联信息" : "Organization association details"}</summary><p>{locale === "zh" ? "将此用户 ID 通过已有业务渠道交给您的对接人员，用于核实后关联公司。不要提供验证码或密码。" : "Share this user ID through your existing business channel to associate your company after verification. Never share verification codes or passwords."}</p><code>{user.id}</code></details><ClientWorkspace locale={locale} {...workspace}/><SignOutButton locale={locale}/></main><SiteFooter locale={locale}/></>;
}
