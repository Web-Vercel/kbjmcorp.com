import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ClientWorkspace from "@/components/client/ClientWorkspace";
export const metadata: Metadata = { title: "客户中心演示 | 智点未来", robots: { index: false, follow: false } };
export default async function Preview({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (locale !== "zh" && locale !== "en") notFound(); const zh = locale === "zh";
 const organizations = [{ id: "demo-org", name: zh ? "演示客户 · 星禾家居" : "Demo client · Starhome" }];
 const projects = [{ id: "demo-project", organization_id: "demo-org", name: zh ? "北美品牌推广 · 演示项目" : "North America brand campaign · Demo project", target_market: "north-america", status: "creative", created_at: "2026-11-01T18:00:00Z", updated_at: "2026-11-05T18:00:00Z" }];
 return <><SiteHeader locale={locale} path="/client-preview"/><main id="main" className="section wrap client-workspace"><p className="admin-demo-banner">{zh ? "客户中心只读演示：所有公司与项目均为虚构，没有连接真实账户，不会保存操作。" : "Read-only client preview: all companies and projects are fictional. No real accounts are connected and no actions are saved."}</p><p className="eyebrow">{zh ? "客户视角" : "CLIENT VIEW"}</p><h1>{zh ? "您的品牌，进展清晰可见。" : "Your brand. Clear progress."}</h1><ClientWorkspace locale={locale} organizations={organizations} projects={projects} demo/><Link className="service-link" href={`/${locale}/admin-preview`}>{zh ? "查看员工后台演示" : "View staff preview"} ↗</Link></main><SiteFooter locale={locale}/></>;
}
