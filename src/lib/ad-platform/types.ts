/** Provider-neutral read integration. No endpoint or API permission is assumed. */
export type AdSource = "manual" | "file_import" | "api";
export type ConnectionState = "unverified" | "connected" | "error" | "disconnected";
export interface ExternalAdvertiser {
  platform: string;
  externalId: string;
  displayName: string;
  currency?: string;
  timezone?: string;
}
export interface ExternalCampaign {
  externalId: string;
  advertiserExternalId: string;
  name: string;
  providerStatus: string;
}
export interface DailyAdvertisingMetric {
  campaignExternalId: string;
  day: string;
  currency: string;
  impressions?: number;
  clicks?: number;
  spend?: string;
  conversions?: string;
}
export interface ReadOnlyAdAdapter {
  readonly source: AdSource;
  readonly capabilities: ReadonlySet<"account" | "campaigns" | "daily_metrics">;
  verifyAccount(externalId: string): Promise<ExternalAdvertiser>;
  readCampaigns(externalId: string): Promise<ExternalCampaign[]>;
  readDailyMetrics(externalId: string, from: string, to: string): Promise<DailyAdvertisingMetric[]>;
}
// Real account identifiers and credentials are private runtime configuration, not fixtures.
// There are deliberately no create-ad, change-budget, charge or pause/resume methods here.


/** Optional source export contract; available only after provider capabilities are verified. */
export interface MonthlySourceArtifact {
 advertiserExternalId: string;
 periodStart: string;
 periodEndExclusive: string;
 sourceTimezone: string;
 sourceCurrency: string;
 originalLanguage: string;
 filename: string;
 mimeType: string;
 sha256: string;
 privateArtifactReference: string;
 collectedAt: string;
}
export interface MonthlySourceReader {
 collectMonthlySource(externalAccountId: string, periodStart: string, periodEndExclusive: string): Promise<MonthlySourceArtifact>;
}
// No implementation is provided: native PDF export, API availability and language
// support must be checked against the actual provider. Never invent export endpoints.
