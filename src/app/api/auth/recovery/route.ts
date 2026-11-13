import { cookies } from "next/headers";
import { openRecovery, sealRecovery, recoveryCookie, recoveryLifetime } from "@/lib/auth/recovery-session";
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
    // This client never installs a workspace session; recovery uses a separate encrypted grant.
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(12000) }) } });
    if (value.action === "request") {
      await client.auth.resetPasswordForEmail(value.email, { captchaToken: value.captchaToken });
      // Do not disclose account existence or upstream errors.
      return authResponse({ ok: true });
    }
    const store = await cookies();
    const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/auth/recovery", maxAge: recoveryLifetime };
    const previous = openRecovery(store.get(recoveryCookie)?.value, value.token, config.rateSecret, config.url);
    // A separate encrypted cookie can resume recovery; it is never an app Auth cookie.
    const verified = previous
      ? await client.auth.refreshSession({ refresh_token: previous.refresh_token })
      : await client.auth.verifyOtp({ token_hash: value.token, type: "recovery" });
    if (verified.error || !verified.data.user || !verified.data.session) {
      store.set(recoveryCookie, "", { ...options, maxAge: 0 });
      return authResponse({ error: "invalid_recovery" }, 400);
    }
    const expiry = previous?.expires ?? Date.now() + recoveryLifetime * 1000;
    const remaining = { ...options, maxAge: Math.max(1, Math.floor((expiry - Date.now()) / 1000)) };
    store.set(recoveryCookie, sealRecovery(verified.data.session, value.token, config.rateSecret, config.url, expiry), remaining);
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return authResponse({ error: "factor_lookup_failed" }, 503);
    const enrolled = factors.data.all.filter(f => f.status === "verified");
    if (enrolled.length) {
      const factor = enrolled.find(f => f.factor_type === "totp");
      if (!factor) return authResponse({ error: "unsupported_factor" }, 400);
      if (!value.code) return authResponse({ error: "mfa_required" }, 400);
      const mfaWait = await consumeAuthLimit(verified.data.user.id, "mfa");
      if (mfaWait) return authResponse({ error: "rate_limited" }, 429, mfaWait);
      const challenge = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value.code });
      if (challenge.error) return authResponse({ error: "invalid_code" }, 400);
      // MFA rotates the refresh token; retain the new session for password-policy retries.
      const session = await client.auth.getSession();
      if (session.error || !session.data.session) return authResponse({ error: "session_failed" }, 503);
      store.set(recoveryCookie, sealRecovery(session.data.session, value.token, config.rateSecret, config.url, expiry), remaining);
    }
    const updated = await client.auth.updateUser({ password: value.password });
    if (updated.error) {
      const code = updated.error.code;
      const error = code === "same_password" ? "same_password" : code === "weak_password" ? "weak_password" : code === "reauthentication_needed" || code === "reauthentication_not_valid" ? "reauthentication_required" : "password_update_failed";
      // Fixed SDK error code only; never record tokens, passwords, email or message text.
      console.warn("Password recovery update rejected", { code: code || "unknown" });
      return authResponse({ error }, 400);
    }
    await client.auth.signOut({ scope: "global" });
    store.set(recoveryCookie, "", { ...options, maxAge: 0 });
    return authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
