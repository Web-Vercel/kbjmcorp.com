import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReportDocument from "@/components/billing/ReportDocument";
import { demoReport, demoLines } from "@/lib/billing/demo";
export const metadata: Metadata = { title: "中文广告月报演示 | 智点未来", robots: { index: false, follow: false } };
export default async function Report({ params }: { params: Promise<{ locale: string; id: string }> }) {
 const { locale, id } = await params; if ((locale !== "zh" && locale !== "en") || id !== demoReport.id) notFound();
 return <><SiteHeader locale={locale} path={`/client-preview/reports/${id}`}/><main id="main" className="wrap section billing-report-page"><Link className="service-link report-back" href={`/${locale}/client-preview`}>← {locale === "zh" ? "返回资金与月报" : "Funds & reports"}</Link><ReportDocument locale={locale} report={demoReport} lines={demoLines} organization={locale === "zh" ? "演示客户 · 星禾家居" : "Demo client · Starhome"}/></main><SiteFooter locale={locale}/></>;
}
