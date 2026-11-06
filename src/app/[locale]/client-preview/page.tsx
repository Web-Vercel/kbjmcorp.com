import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BillingDashboard from "@/components/billing/BillingDashboard";
import { demoBilling } from "@/lib/billing/demo";
import ClientWorkspace from "@/components/client/ClientWorkspace";
export const metadata: Metadata = { title: "客户中心演示 | 智点未来", robots: { index: false, follow: false } };
export default async function Preview({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (locale !== "zh" && locale !== "en") notFound(); const zh = locale === "zh";
 const organizations = [{ id: "demo-org", name: zh ? "演示客户 · 星禾家居" : "Demo client · Starhome" }];
 const projects = [{ id: "demo-project", organization_id: "demo-org", name: zh ? "北美品牌推广 · 演示项目" : "North America brand campaign · Demo project", target_market: "north-america", status: "creative", created_at: "2026-11-01T18:00:00Z", updated_at: "2026-11-05T18:00:00Z" }];
 return <><SiteHeader locale={locale} path="/client-preview"/><main id="main" className="section wrap client-workspace"><p className="admin-demo-banner">{zh ? "客户中心演示：充值、余额与报告全部虚构，没有连接支付或真实广告账户；演示申请仅在当前页面内存保存，刷新即清空。" : "Client preview: all funds, top-ups and reports are fictional. No payment or real advertising account is connected. Demo requests exist only in page memory and clear on refresh."}</p><p className="eyebrow">{zh ? "客户视角" : "CLIENT VIEW"}</p><h1>{zh ? "账户资金清晰，每月花费有据。" : "Clear funds. Accountable monthly spending."}</h1><BillingDashboard locale={locale} data={demoBilling(locale)} demo/><details className="billing-supplement"><summary>{zh ? "其他服务：项目进度与创意协作" : "Other services: projects and creative collaboration"}</summary><Link className="button" href={`/${locale}/workflow-preview`}>{zh ? "体验需求提交与创意确认" : "Try briefs and creative approval"} ↗</Link><ClientWorkspace locale={locale} organizations={organizations} projects={projects} demo/></details><Link className="service-link" href={`/${locale}/admin-preview`}>{zh ? "查看员工后台演示" : "View staff preview"} ↗</Link></main><SiteFooter locale={locale}/></>;
}
