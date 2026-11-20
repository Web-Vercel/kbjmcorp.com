import {mfaDeadline} from '@/lib/auth/mfa-window';
import { z } from "zod";
import {getLiveContext} from "@/lib/live-access/server";
import { consumeAuthLimit } from "@/lib/auth/rate-limit";
import { authResponse, readAuthBody } from "@/lib/auth/http";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll"), restart: z.boolean().optional(), expectedUserId: z.uuid().optional() }),
  z.object({ action: z.literal("verify"), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/), expectedUserId: z.uuid().optional() }),
]);
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = schema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getLiveContext(false); if ("error" in staff) return authResponse({error:staff.error},staff.status);
  if(parsed.data.expectedUserId&&parsed.data.expectedUserId!==staff.user.id)return authResponse({error:"session_changed"},409);
  try {
    const wait = await consumeAuthLimit(staff.user.id, "mfa");
    if (wait) return authResponse({ error: "rate_limited" }, 429, wait);
    const { data: factors, error: listError } = await staff.client.auth.mfa.listFactors();
    if (listError) return authResponse({ error: "unavailable" }, 503);
    const assurance=await staff.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error)return authResponse({error:'unavailable'},503);
    if(assurance.data?.currentLevel==='aal2')return authResponse({ok:true,complete:true});
    const deadline=mfaDeadline(staff.user.last_sign_in_at,factors.totp.some(f=>f.status==='verified'));
    if(deadline===null)return authResponse({error:'unavailable'},503);
    if(Date.now()>=deadline)return authResponse({error:'mfa_timeout'},408);
    if (parsed.data.action === "enroll") {
      if (factors.totp.some(f => f.status === "verified")) return authResponse({ error: "already_enrolled" }, 409);
      const pending = factors.all.filter(f => f.factor_type === "totp" && f.status === "unverified");
      if (pending.length && !parsed.data.restart) return authResponse({ error: "pending_enrollment" }, 409);
      for (const factor of pending) { const r = await staff.client.auth.mfa.unenroll({ factorId: factor.id }); if (r.error) return authResponse({ error: "unavailable" }, 503); }
      const { data, error } = await staff.client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Account authenticator" });
      if (error) return authResponse({ error: "unavailable" }, 503);
      if(Date.now()>=deadline)return authResponse({error:'mfa_timeout'},408);
      return authResponse({ factorId: data.id, qrCode: data.totp.qr_code });
    }
    const verification = parsed.data;
    if (!factors.all.some(f => f.id === verification.factorId && f.factor_type === "totp")) return authResponse({ error: "invalid_code" }, 400);
    const { error } = await staff.client.auth.mfa.challengeAndVerify({ factorId: verification.factorId, code: verification.code });
    if(!error&&Date.now()>=deadline){const logout=await staff.client.auth.signOut({scope:'local'});if(logout.error)return authResponse({error:'logout_failed'},502);return authResponse({error:'mfa_timeout'},408);}
    return error ? authResponse({ error: "invalid_code" }, 400) : authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
