import "server-only";

export function getAuthConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rateSecret = process.env.AUTH_RATE_LIMIT_SECRET;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const codeLength = Number(process.env.AUTH_OTP_LENGTH || "6");
  if (process.env.SMS_AUTH_ENABLED !== "true" || !url || !key || !serviceKey ||
      !rateSecret || rateSecret.length < 32 || !siteKey ||
      !Number.isInteger(codeLength) || codeLength < 6 || codeLength > 10) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return { url, key, serviceKey, rateSecret, siteKey, codeLength };
}
