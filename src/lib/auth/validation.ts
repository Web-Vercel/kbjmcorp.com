import { z } from "zod";

export const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/);
export const requestCodeSchema = z.object({
  phone: phoneSchema,
  consent: z.literal(true),
  captchaToken: z.string().min(1).max(4096),
});
export const verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6,10}$/),
});
export function toE164(phone: string) {
  return `+86${phoneSchema.parse(phone)}`;
}
export function maskPhone(phone: string | undefined) {
  return phone?.replace(/^(\+?86)?(1\d{2})\d{4}(\d{4})$/, "+86 $2****$3") || "—";
}
