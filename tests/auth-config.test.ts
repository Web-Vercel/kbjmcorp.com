import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { getSessionConfig,getAuthConfig,getStaffLoginConfig } from "@/lib/auth/config";
beforeEach(()=>{
 vi.stubEnv('SUPABASE_URL','https://fixture.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','fixture-public');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-service-only');vi.stubEnv('AUTH_RATE_LIMIT_SECRET','fixture-secret-at-least-thirty-two-characters');vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY','fixture-site-key');vi.stubEnv('SMS_AUTH_ENABLED','false');
});
afterEach(()=>vi.unstubAllEnvs());
it("keeps staff authentication and session refresh independent of customer SMS activation",()=>{expect(getSessionConfig()).not.toBeNull();expect(getStaffLoginConfig()).not.toBeNull();expect(getAuthConfig()).toBeNull();});
it("does not enable staff password attempts without shared anti-abuse configuration",()=>{vi.stubEnv('AUTH_RATE_LIMIT_SECRET','');expect(getStaffLoginConfig()).toBeNull();expect(getSessionConfig()).not.toBeNull();});
it("keeps the service-role key out of the ordinary user session client config",()=>{expect(getSessionConfig()).toEqual({url:'https://fixture.supabase.co',key:'fixture-public'});});
