import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ store: new Map<string, { value: string; options: Record<string, unknown> }>(), config: { url: "https://fixture.supabase.co", key: "fixture-public-key", codeLength: 6 } }));
vi.mock("@/lib/auth/config", () => ({ getSessionConfig: () => fixture.config }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  getAll: () => Array.from(fixture.store, ([name, entry]) => ({ name, value: entry.value })),
  set: (name: string, value: string, options: Record<string, unknown>) => fixture.store.set(name, { value, options }),
}) }));
import { authClient } from "@/lib/auth/server";
beforeEach(() => fixture.store.clear());
afterEach(() => vi.unstubAllGlobals());
it("official SSR client persists verified sessions in HttpOnly cookies and clears them at logout", async () => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "fixture-user", exp: now + 3600, iat: now })).toString("base64url")}.${Buffer.from("fixture-signature").toString("base64url")}`;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/verify")) return new Response(JSON.stringify({ access_token: jwt, refresh_token: "fixture-refresh", expires_in: 3600, expires_at: now + 3600, token_type: "bearer", user: { id: "fixture-user", phone: "8613800138000", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/logout")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ id: "fixture-user", aud: "authenticated" }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = await authClient(true);
  const result = await client!.auth.verifyOtp({ phone: "+8613800138000", token: "123456", type: "sms" });
  expect(result.error).toBeNull();
  const cookies = Array.from(fixture.store).filter(([name, entry]) => name.includes("auth-token") && entry.value);
  expect(cookies.length).toBeGreaterThan(0);
  for (const [, entry] of cookies) { expect(entry.options.httpOnly).toBe(true); expect(entry.options.sameSite).toBe("lax"); }
  const secondClient = await authClient(true);
  const user = await secondClient!.auth.getUser(); expect(user.data.user?.id).toBe("fixture-user");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/v1/user"), expect.anything());
  expect((await secondClient!.auth.signOut({ scope: "local" })).error).toBeNull();
  expect(Array.from(fixture.store).filter(([name, entry]) => name.includes("auth-token") && entry.value)).toHaveLength(0);
});

it("official SSR client persists the aal2 session after authenticator verification", async () => {
  const now=Math.floor(Date.now()/1000);
  const token=(aal:string)=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:'fixture-user',exp:now+3600,iat:now,aal,amr:[]})).toString('base64url')}.${Buffer.from("fixture-signature").toString("base64url")}`;
  const user={id:'fixture-user',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString(),factors:[{id:'fixture-factor',factor_type:'totp',status:'verified',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]};
  const session=(aal:string)=>({access_token:token(aal),refresh_token:`fixture-${aal}`,expires_in:3600,expires_at:now+3600,token_type:'bearer',user});
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.includes('/factors/fixture-factor/challenge'))return new Response(JSON.stringify({id:'fixture-challenge',expires_at:now+300}),{status:200,headers:{'Content-Type':'application/json'}});
    if(url.includes('/factors/fixture-factor/verify'))return new Response(JSON.stringify(session('aal2')),{status:200,headers:{'Content-Type':'application/json'}});
    if(url.includes('/verify'))return new Response(JSON.stringify(session('aal1')),{status:200,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}});
  }));
  const client=await authClient(true);
  expect((await client!.auth.verifyOtp({phone:'+8613800138000',token:'123456',type:'sms'})).error).toBeNull();
  const before=JSON.stringify(Array.from(fixture.store));
  expect((await client!.auth.mfa.challengeAndVerify({factorId:'fixture-factor',code:'123456'})).error).toBeNull();
  expect(JSON.stringify(Array.from(fixture.store))).not.toBe(before);
  const next=await authClient(true);
  expect((await next!.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel).toBe('aal2');
  expect(Array.from(fixture.store.values()).filter(entry=>entry.value).every(entry=>entry.options.httpOnly===true)).toBe(true);
});

it('does not expose a real auth client during a demo, even with a real session cookie present',async()=>{
 fixture.store.set('sb-fixture-auth-token',{value:'FICTIONAL-REAL-SESSION',options:{}});fixture.store.set('zhidian_demo_session',{value:'FICTIONAL-DEMO',options:{}});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await authClient(true)).toBeNull();expect(fetcher).not.toHaveBeenCalled();expect(fixture.store.has('sb-fixture-auth-token')).toBe(true);fixture.store.delete('zhidian_demo_session');expect(await authClient()).not.toBeNull();
});
