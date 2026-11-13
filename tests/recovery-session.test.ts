import { expect, it, vi } from "vitest";
import { openRecovery, sealRecovery } from "@/lib/auth/recovery-session";
it("encrypts recovery credentials, binds them to project and link, rejects tampering and expiry",()=>{
 const session={access_token:"private-access",refresh_token:"private-refresh"},secret="a".repeat(64),project="https://fixture.test",token="a".repeat(64);
 const encrypted=sealRecovery(session,token,secret,project);
 expect(encrypted).not.toContain("private");expect(openRecovery(encrypted,token,secret,project)?.access_token).toBe(session.access_token);
 expect(openRecovery(encrypted,token,secret,"https://other.test")).toBeNull();expect(openRecovery(encrypted,"b".repeat(64),secret,project)).toBeNull();
 expect(openRecovery(encrypted.slice(0,-10)+"tampered",token,secret,project)).toBeNull();
 vi.spyOn(Date,"now").mockReturnValue(Date.now()+601000);expect(openRecovery(encrypted,token,secret,project)).toBeNull();vi.restoreAllMocks();
});
