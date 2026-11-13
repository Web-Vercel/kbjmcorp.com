import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
export const recoveryCookie = "password-recovery";
export const recoveryLifetime = 600;
type Grant = { access_token: string; refresh_token: string; token: string; expires: number };
function key(secret: string, project: string) { return Buffer.from(hkdfSync("sha256", secret, project, "password-recovery-v1", 32)); }
function digest(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function sealRecovery(session: { access_token: string; refresh_token: string }, token: string, secret: string, project: string, expires = Date.now() + recoveryLifetime * 1000) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret, project), iv);
  const payload: Grant = { access_token: session.access_token, refresh_token: session.refresh_token, token: digest(token), expires };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function openRecovery(value: string | undefined, token: string, secret: string, project: string): Grant | null {
  if (!value || value.length > 12000) return null;
  try {
    const raw = Buffer.from(value, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(secret, project), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const grant = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()) as Grant;
    return grant.expires > Date.now() && grant.token === digest(token) && typeof grant.access_token === "string" && typeof grant.refresh_token === "string" ? grant : null;
  } catch { return null; }
}
