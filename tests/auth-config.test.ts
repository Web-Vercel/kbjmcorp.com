import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { getSessionConfig,getAuthConfig,getStaffLoginConfig } from "@/lib/auth/config";
beforeEach(()=>{
 vi.stubEnv('SUPABASE_SECRET_KEY','');vi.stubEnv('SUPABASE_URL','https://fixture.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','fixture-public');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-service-only');vi.stubEnv('AUTH_RATE_LIMIT_SECRET','fixture-secret-at-least-thirty-two-characters');vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY','fixture-site-key');vi.stubEnv('SMS_AUTH_ENABLED','false');
});
afterEach(()=>vi.unstubAllEnvs());
it("keeps staff authentication and session refresh independent of customer SMS activation",()=>{expect(getSessionConfig()).not.toBeNull();expect(getStaffLoginConfig()).not.toBeNull();expect(getAuthConfig()).toBeNull();});
it("does not enable staff password attempts without shared anti-abuse configuration",()=>{vi.stubEnv('AUTH_RATE_LIMIT_SECRET','');expect(getStaffLoginConfig()).toBeNull();expect(getSessionConfig()).not.toBeNull();});
it("keeps the service-role key out of the ordinary user session client config",()=>{expect(getSessionConfig()).toEqual({url:'https://fixture.supabase.co',key:'fixture-public'});});
it('prefers the new server secret without placing it in user-session configuration',()=>{
 vi.stubEnv('SUPABASE_SECRET_KEY','sb_secret_NEW_SERVER_ONLY');expect(getStaffLoginConfig()?.serviceKey).toBe('sb_secret_NEW_SERVER_ONLY');expect(getSessionConfig()?.key).toBe('fixture-public');
});
it('does not silently fall back to an old privileged key when a new secret is malformed',()=>{
 vi.stubEnv('SUPABASE_SECRET_KEY','SUPABASE_SECRET_KEY=sb_secret_TEST');expect(getStaffLoginConfig()).toBeNull();expect(getSessionConfig()).not.toBeNull();
});
it('rejects assignment prefixes and privileged secrets in the user-session key setting',()=>{
 vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_secret_MISPLACED');expect(getSessionConfig()).toBeNull();vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture');expect(getSessionConfig()).toBeNull();
});
it('rejects copied URL assignments, subpaths and malformed HMAC settings',()=>{
 vi.stubEnv('SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL=https://fixture.supabase.co');expect(getSessionConfig()).toBeNull();vi.stubEnv('SUPABASE_URL','https://fixture.supabase.co/private');expect(getSessionConfig()).toBeNull();vi.stubEnv('SUPABASE_URL','https://fixture.supabase.co');vi.stubEnv('AUTH_RATE_LIMIT_SECRET','AUTH_RATE_LIMIT_SECRET=fixture-secret-at-least-thirty-two-characters');expect(getStaffLoginConfig()).toBeNull();
});
it('does not enable staff login for a copied Turnstile assignment',()=>{vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY=fixture');expect(getStaffLoginConfig()).toBeNull();});
