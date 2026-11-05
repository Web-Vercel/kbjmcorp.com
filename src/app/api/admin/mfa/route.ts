import { z } from "zod";
import { getStaffContext, staffError } from "@/lib/admin/guard";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authResponse, readAuthBody } from "@/lib/auth/http";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll"), restart: z.boolean().optional() }),
  z.object({ action: z.literal("verify"), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }),
]);
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = schema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(false); if ("error" in staff) return staffError(staff);
  try {
    const wait = await consumeAuthLimit(staff.user.id, "mfa");
    if (wait) return authResponse({ error: "rate_limited" }, 429, wait);
    const { data: factors, error: listError } = await staff.client.auth.mfa.listFactors();
    if (listError) return authResponse({ error: "unavailable" }, 503);
    if (parsed.data.action === "enroll") {
      if (factors.totp.some(f => f.status === "verified")) return authResponse({ error: "already_enrolled" }, 409);
      const pending = factors.all.filter(f => f.factor_type === "totp" && f.status === "unverified");
      if (pending.length && !parsed.data.restart) return authResponse({ error: "pending_enrollment" }, 409);
      for (const factor of pending) { const r = await staff.client.auth.mfa.unenroll({ factorId: factor.id }); if (r.error) return authResponse({ error: "unavailable" }, 503); }
      const { data, error } = await staff.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Staff authenticator" });
      if (error) return authResponse({ error: "unavailable" }, 503);
      return authResponse({ factorId: data.id, qrCode: data.totp.qr_code });
    }
    const verification = parsed.data;
    if (!factors.all.some(f => f.id === verification.factorId && f.factor_type === "totp")) return authResponse({ error: "invalid_code" }, 400);
    const { error } = await staff.client.auth.mfa.challengeAndVerify({ factorId: verification.factorId, code: verification.code });
    return error ? authResponse({ error: "invalid_code" }, 400) : authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
