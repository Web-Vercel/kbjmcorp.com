import "server-only";

export function getSessionConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return { url, key };
}
export function getRateLimitConfig() {
  const session = getSessionConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rateSecret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!session || !serviceKey || !rateSecret || rateSecret.length < 32) return null;
  return { ...session, serviceKey, rateSecret };
}
export function getStaffLoginConfig() {
  const config = getRateLimitConfig();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return config && siteKey ? { ...config, siteKey } : null;
}
export function getAuthConfig() {
  const config = getStaffLoginConfig();
  const codeLength = Number(process.env.AUTH_OTP_LENGTH || "6");
  if (process.env.SMS_AUTH_ENABLED !== "true" || !config ||
      !Number.isInteger(codeLength) || codeLength < 6 || codeLength > 10) return null;
  return { ...config, codeLength };
}
