import { getAuthConfig } from "@/lib/auth/config";
import { authResponse, readAuthBody } from "@/lib/auth/http";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authClient } from "@/lib/auth/server";
import { toE164, verifyCodeSchema } from "@/lib/auth/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (input.error) return input.error;
  const parsed = verifyCodeSchema.safeParse(input.body);
  if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const config = getAuthConfig();
  if (!config) return authResponse({ error: "unavailable" }, 503);
  if (parsed.data.code.length !== config.codeLength) return authResponse({ error: "invalid_input" }, 400);
  try {
    const wait = await consumeAuthLimit(parsed.data.phone, "verify");
    if (wait > 0) return authResponse({ error: "rate_limited" }, 429, wait);
    const client = await authClient(true);
    if (!client) return authResponse({ error: "unavailable" }, 503);
    const { data, error } = await client.auth.verifyOtp({ phone: toE164(parsed.data.phone), token: parsed.data.code, type: "sms" });
    if (error || !data.user || !data.session) return authResponse({ error: "invalid_code" }, 400);
    return authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
