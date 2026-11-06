import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ReportDocument from "@/components/billing/ReportDocument";
import { requireClientPage } from "@/lib/client/page";
import { reportColumns } from "@/lib/billing/data";
import type { MonthlyReport, ReportLine } from "@/lib/billing/model";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "广告月报 | 智点未来", robots: { index: false, follow: false } };
export default async function Report({ params }: { params: Promise<{ locale: string; id: string }> }) {
 const { locale, id } = await params; if (locale !== "zh" && locale !== "en") notFound();
 const { client } = await requireClientPage(locale); if (!z.uuid().safeParse(id).success) notFound();
 const result = await client.from("monthly_ad_reports").select(reportColumns).eq("id", id).maybeSingle();
 if (!result.error && !result.data) notFound();
 const [lines, company] = result.data ? await Promise.all([client.from("monthly_ad_report_lines").select("id,report_id,campaign,market,impressions,clicks,spend_minor").eq("report_id", id).order("id").limit(1001), client.from("organizations").select("name").eq("id", result.data.organization_id).maybeSingle()]) : [{ data: null, error: true }, { data: null, error: true }];
 const failed = result.error || lines.error || company.error || !company.data || (lines.data?.length || 0) > 1000;
 const report = result.data ? { ...result.data, ad_spend_minor: String(result.data.ad_spend_minor), service_fee_minor: String(result.data.service_fee_minor) } as MonthlyReport : null;
 const detail = lines.data?.map(line => ({ ...line, impressions: line.impressions === null ? null : String(line.impressions), clicks: line.clicks === null ? null : String(line.clicks), spend_minor: String(line.spend_minor) })) as ReportLine[];
 return <><SiteHeader locale={locale} path="/account"/><main id="main" className="wrap section billing-report-page"><Link className="service-link report-back" href={`/${locale}/account`}>← {locale === "zh" ? "返回资金与月报" : "Funds & reports"}</Link>{failed || !report ? <p className="admin-error">{locale === "zh" ? "暂时无法读取完整月报，请联系业务人员核实。" : "The complete report is unavailable. Contact your representative."}</p> : <ReportDocument locale={locale} report={report} lines={detail} organization={company.data!.name}/>}</main><SiteFooter locale={locale}/></>;
}
