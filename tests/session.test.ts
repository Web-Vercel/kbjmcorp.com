import { beforeEach, afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ store: new Map<string, { value: string; options: Record<string, unknown> }>(), config: { url: "https://fixture.supabase.co", key: "fixture-public-key", codeLength: 6 } }));
vi.mock("@/lib/auth/config", () => ({ getAuthConfig: () => fixture.config }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  getAll: () => Array.from(fixture.store, ([name, entry]) => ({ name, value: entry.value })),
  set: (name: string, value: string, options: Record<string, unknown>) => fixture.store.set(name, { value, options }),
}) }));
import { authClient } from "@/lib/auth/server";
beforeEach(() => fixture.store.clear());
afterEach(() => vi.unstubAllGlobals());
it("official SSR client persists verified sessions in HttpOnly cookies and clears them at logout", async () => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "fixture-user", exp: now + 3600, iat: now })).toString("base64url")}.fixture-signature`;
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
