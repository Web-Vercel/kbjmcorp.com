import { getAuthConfig } from "@/lib/auth/config";
import { authResponse, readAuthBody } from "@/lib/auth/http";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authClient } from "@/lib/auth/server";
import { requestCodeSchema, toE164 } from "@/lib/auth/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (input.error) return input.error;
  const parsed = requestCodeSchema.safeParse(input.body);
  if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  if (!getAuthConfig()) return authResponse({ error: "unavailable" }, 503);
  try {
    const wait = await consumeAuthLimit(parsed.data.phone, "sms");
    if (wait > 0) return authResponse({ error: "rate_limited" }, 429, wait);
    const client = await authClient(true);
    if (!client) return authResponse({ error: "unavailable" }, 503);
    const { error } = await client.auth.signInWithOtp({
      phone: toE164(parsed.data.phone),
      options: { shouldCreateUser: true, captchaToken: parsed.data.captchaToken },
    });
    if (error) return authResponse({ error: error.status === 429 ? "rate_limited" : "send_failed" }, error.status === 429 ? 429 : 502, error.status === 429 ? 60 : undefined);
    // Means the provider accepted the request, not that the handset received it.
    return authResponse({ ok: true, retryAfter: 60 });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
