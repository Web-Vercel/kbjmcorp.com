import { z } from "zod";
import { getStaffLoginConfig } from "@/lib/auth/config";
import { authClient } from "@/lib/auth/server";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authResponse, readAuthBody } from "@/lib/auth/http";
const schema = z.object({ email: z.email().max(254), password: z.string().min(1).max(256), captchaToken: z.string().min(1).max(4096) });
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = schema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  if (!getStaffLoginConfig()) return authResponse({ error: "unavailable" }, 503);
  try {
    const wait = await consumeAuthLimit(parsed.data.email.trim().toLowerCase(), "staff");
    if (wait) return authResponse({ error: "rate_limited" }, 429, wait);
    const client = await authClient(true); if (!client) return authResponse({ error: "unavailable" }, 503);
    const { data, error } = await client.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password, options: { captchaToken: parsed.data.captchaToken } });
    if (error || !data.user) return authResponse({ error: "invalid_credentials" }, 401);
    const membership = await client.from("staff_members").select("role,active").eq("user_id", data.user.id).maybeSingle();
    if (membership.error || !membership.data?.active || !["admin", "operator"].includes(membership.data.role)) {
      await client.auth.signOut({ scope: "local" }); return authResponse({ error: "invalid_credentials" }, 401);
    }
    return authResponse({ ok: true, requiresMfa: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
