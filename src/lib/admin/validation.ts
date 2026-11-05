import { z } from "zod";
export const inquiryUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["new", "qualified", "closed"]) }),
  z.object({ action: z.literal("note"), body: z.string().trim().min(1).max(2000) }),
]);
export const companyConversionSchema = z.object({ companyName: z.string().trim().min(2).max(160) });
export const projectSchema = z.object({
  organizationId: z.uuid(), adAccountId: z.union([z.uuid(), z.literal("")]).default(""), name: z.string().trim().min(2).max(160),
  market: z.enum(["undecided", "north-america", "europe", "asia-pacific", "global", "other"]),
  budget: z.union([z.literal(""), z.string().regex(/^\d{1,10}(\.\d{1,2})?$/)]).default(""),
  currency: z.enum(["CAD", "USD", "CNY", "EUR", "GBP", "AUD"]),
});
export const projectStatusSchema = z.object({ id: z.uuid(), status: z.enum(["briefing", "creative", "review", "ready", "active", "paused", "completed"]) });
export const accountSchema = z.object({ organizationId: z.uuid(), confirm: z.literal("on"), externalId: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9._:-]+$/), label: z.string().trim().min(2).max(160) });
