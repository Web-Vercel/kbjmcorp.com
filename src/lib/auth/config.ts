import "server-only";
import { getPrivilegedKey } from "./privileged-config";

export function getSessionConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.trim() !== url || /\s/.test(key) || key.includes('=') || key.startsWith('sb_secret_')) return null;
  try { const parsed = new URL(url); if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null; } catch { return null; }
  return { url, key };
}
export function getRateLimitConfig() {
  const session = getSessionConfig();
  const serviceKey = getPrivilegedKey();
  const rateSecret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!session || !serviceKey || !rateSecret || rateSecret.length < 32 || rateSecret.trim() !== rateSecret || rateSecret.startsWith("AUTH_RATE_LIMIT_SECRET=")) return null;
  return { ...session, serviceKey, rateSecret };
}
export function getStaffLoginConfig() {
  const config = getRateLimitConfig();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return config && siteKey && !/\s|=/.test(siteKey) ? { ...config, siteKey } : null;
}
export function getAuthConfig() {
  const config = getStaffLoginConfig();
  const codeLength = Number(process.env.AUTH_OTP_LENGTH || "6");
  if (process.env.SMS_AUTH_ENABLED !== "true" || !config ||
      !Number.isInteger(codeLength) || codeLength < 6 || codeLength > 10) return null;
  return { ...config, codeLength };
}
