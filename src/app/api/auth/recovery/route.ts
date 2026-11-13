import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getStaffLoginConfig } from "@/lib/auth/config";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authResponse, readAuthBody } from "@/lib/auth/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), email: z.email().max(254), captchaToken: z.string().min(1).max(4096) }),
  z.object({ action: z.literal("reset"), token: z.string().regex(/^[a-fA-F0-9]{40,128}$/), password: z.string().min(12).max(256), code: z.string().regex(/^\d{6}$/).optional() }),
]);
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = schema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const config = getStaffLoginConfig(); if (!config) return authResponse({ error: "unavailable" }, 503);
  try {
    const value = parsed.data;
    const wait = await consumeAuthLimit(value.action === "request" ? value.email.toLowerCase() : value.token, "recovery");
    if (wait) return authResponse({ error: "rate_limited" }, 429, wait);
    // Recovery credentials never become browser cookies or a workspace session.
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12000) }) } });
    if (value.action === "request") {
      await client.auth.resetPasswordForEmail(value.email, { captchaToken: value.captchaToken });
      // Do not disclose account existence or upstream errors.
      return authResponse({ ok: true });
    }
    const verified = await client.auth.verifyOtp({ token_hash: value.token, type: "recovery" });
    if (verified.error || !verified.data.user || !verified.data.session) return authResponse({ error: "invalid_recovery" }, 400);
    try {
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) return authResponse({ error: "reset_failed" }, 400);
      const enrolled = factors.data.all.filter(f => f.status === "verified");
      if (enrolled.length) {
        const factor = enrolled.find(f => f.factor_type === "totp");
        if (!factor || !value.code) return authResponse({ error: "mfa_required" }, 400);
        const mfaWait = await consumeAuthLimit(verified.data.user.id, "mfa");
        if (mfaWait) return authResponse({ error: "rate_limited" }, 429, mfaWait);
        const challenge = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value.code });
        if (challenge.error) return authResponse({ error: "invalid_code" }, 400);
      }
      const updated = await client.auth.updateUser({ password: value.password });
      if (updated.error) return authResponse({ error: "reset_failed" }, 400);
      return authResponse({ ok: true });
    } finally {
      // Revoke the temporary recovery session; never bypass MFA or grant roles.
      await client.auth.signOut({ scope: "global" });
    }
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
