import { z } from "zod";
export type Currency = "CAD" | "USD" | "CNY" | "EUR" | "GBP" | "AUD";
export function toMinor(value: string): string {
 if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) throw new Error("Invalid amount");
 const [whole, fraction = ""] = value.split(".");
 const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
 if (result <= 0n) throw new Error("Amount must be positive");
 return result.toString();
}
export function money(value: string, currency: Currency, locale: "zh" | "en") {
 const amount = BigInt(value); const absolute = amount < 0n ? -amount : amount;
 const whole = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-CA").format(absolute / 100n);
 return `${amount < 0n ? "−" : ""}${currency} ${whole}.${(absolute % 100n).toString().padStart(2, "0")}`;
}
export const topupSchema = z.object({ walletId: z.uuid(), amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).refine(value => { try { return BigInt(toMinor(value)) > 0n; } catch { return false; } }), reference: z.string().trim().min(3).max(120), confirm: z.literal("on") });
export type Wallet = { id: string; organization_id: string; organization_name: string; currency: Currency; balance_minor: string; credited_minor: string; updated_at: string | null; can_request: boolean };
export type LedgerEntry = { id: string; wallet_id: string; kind: "topup" | "ad_spend" | "service_fee" | "refund" | "adjustment"; amount_minor: string; description: string; posted_at: string };
export type Topup = { id: string; wallet_id: string; amount_minor: string; reference: string; status: "pending" | "credited" | "rejected"; created_at: string };
export type MonthlyReport = { id: string; wallet_id: string; organization_id: string; month: string; version: number; currency: Currency; ad_spend_minor: string; service_fee_minor: string; source_language: "en" | "zh" | "other"; translation_status: "not_needed" | "pending" | "reviewed"; source_filename: string; source_account_name: string; source_timezone: string; published_at: string; summary_zh: string | null; summary_en: string | null; demo?: boolean };
export type ReportLine = { id: string; report_id: string; campaign: string; market: string; impressions: string | null; clicks: string | null; spend_minor: string };
export type BillingData = { wallets: Wallet[]; entries: LedgerEntry[]; topups: Topup[]; reports: MonthlyReport[]; error: boolean };
export function monthLabel(month: string, locale: "zh" | "en") { return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-CA", { year: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${month.slice(0, 10)}T12:00:00Z`)); }
