import { cadSettlement, allocateConvertedLines } from "./fx";
import type { BillingData, MonthlyReport, ReportLine } from "./model";
const demoRate = "5.20000000";
const converted = cadSettlement("235000", demoRate);
const convertedLines = allocateConvertedLines(["125000", "80000", "30000"], demoRate);
export const demoReport: MonthlyReport = { id: "demo-2026-10", wallet_id: "demo-wallet", organization_id: "demo-org", month: "2026-10-01", version: 1, currency: "CNY", ad_spend_minor: converted.adSpendMinor, service_fee_minor: converted.feeMinor, source_currency: "CAD", source_ad_spend_minor: "235000", settlement_date: "2026-11-03", fee_basis_points: 0, fx: { id: "demo-rate", cad_cny_rate: demoRate, value_date: "2026-11-03", quoted_at: "2026-11-03T02:00:00Z", source_name: "虚构报价 / Fictional quote · NOT LIVE", is_demo: true }, source_language: "en", translation_status: "reviewed", source_filename: "DEMO-platform-report-2026-10.csv", source_account_name: "Starhome North America · 演示广告账户", source_timezone: "America/Toronto", published_at: "2026-11-03T08:00:00Z", summary_zh: "本月演示推广覆盖北美市场。以下活动名称、指标与费用均为虚构，用于展示中文报告的结构；不代表实际投放结果。", summary_en: "A fictional monthly campaign example for North America. Campaigns, metrics and costs are illustrative and do not represent live advertising results.", demo: true };
export const demoLines: ReportLine[] = [
 { id: "line-1", report_id: demoReport.id, campaign: "Brand discovery / 品牌认知", market: "Canada / 加拿大", impressions: "50000", clicks: "1200", source_cad_minor: "125000", spend_minor: convertedLines[0] },
 { id: "line-2", report_id: demoReport.id, campaign: "Product discovery / 产品推广", market: "United States / 美国", impressions: "32000", clicks: "750", source_cad_minor: "80000", spend_minor: convertedLines[1] },
 { id: "line-3", report_id: demoReport.id, campaign: "Seasonal campaign / 季节推广", market: "North America / 北美", impressions: "12000", clicks: "240", source_cad_minor: "30000", spend_minor: convertedLines[2] },
];
export function demoBilling(locale: "zh" | "en"): BillingData {
 const zh = locale === "zh";
 return { error: false, wallets: [{ id: "demo-wallet", organization_id: "demo-org", organization_name: zh ? "演示客户 · 星禾家居" : "Demo client · Starhome", currency: "CNY", balance_minor: (5000000n - BigInt(converted.totalMinor)).toString(), credited_minor: "5000000", updated_at: "2026-11-03T18:00:00Z", can_request: true }], reports: [demoReport], topups: [], entries: [
  { id: "entry-2", wallet_id: "demo-wallet", kind: "ad_spend", amount_minor: `-${converted.adSpendMinor}`, description: zh ? "10 月广告费用 · 演示" : "October advertising spend · Demo", posted_at: "2026-11-03T18:00:00Z" },
  { id: "entry-1", wallet_id: "demo-wallet", kind: "topup", amount_minor: "5000000", description: zh ? "已核对到账的充值 · 演示" : "Verified top-up · Demo", posted_at: "2026-10-01T18:00:00Z" },
 ] };
}
