import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ config: vi.fn(), limit: vi.fn(), create: vi.fn(), verify: vi.fn(), update: vi.fn(), logout: vi.fn(), send: vi.fn(), factors: vi.fn(), challenge: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ getStaffLoginConfig: m.config }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthLimit: m.limit }));
vi.mock("@supabase/supabase-js", () => ({ createClient: m.create }));
import { POST } from "@/app/api/auth/recovery/route";
const token = "a".repeat(64);
const reset = { action: "reset", token, password: "FICTIONAL-password-42" };
function req(body: object, origin = "https://site.example") { return new Request("https://site.example/api/auth/recovery", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => {
  vi.clearAllMocks(); m.config.mockReturnValue({ url: "https://fixture.example", key: "fixture" }); m.limit.mockResolvedValue(0);
  m.create.mockReturnValue({ auth: { verifyOtp: m.verify, updateUser: m.update, signOut: m.logout, resetPasswordForEmail: m.send, mfa: { listFactors: m.factors, challengeAndVerify: m.challenge } } });
  m.factors.mockResolvedValue({ data: { all: [] }, error: null }); m.challenge.mockResolvedValue({ error: null });
  m.verify.mockResolvedValue({ data: { user: { id: "fixture" }, session: {} }, error: null }); m.update.mockResolvedValue({ error: null }); m.logout.mockResolvedValue({ error: null }); m.send.mockResolvedValue({ error: null });
});
it("requires explicit same origin and a recovery hash; rejects weak passwords before remote calls", async () => {
  expect((await POST(req(reset, "https://attacker.example"))).status).toBe(403);
  expect((await POST(req({ ...reset, password: "short" }))).status).toBe(400);
  expect((await POST(req({ ...reset, token: "ordinary-access-token" }))).status).toBe(400);
  expect(m.create).not.toHaveBeenCalled();
});
it("fails closed on expired or reused tokens even with an existing browser session", async () => {
  m.verify.mockResolvedValue({ data: {}, error: { message: "private upstream detail" } });
  const response = await POST(req(reset)); expect(response.status).toBe(400); expect(await response.text()).not.toContain("private"); expect(m.update).not.toHaveBeenCalled();
});
it("updates only after recovery verification, never persists a browser session, and revokes recovery sessions", async () => {
  expect((await POST(req(reset))).status).toBe(200);
  expect(m.verify).toHaveBeenCalledWith({ token_hash: token, type: "recovery" }); expect(m.update).toHaveBeenCalledWith({ password: reset.password });
  expect(m.create.mock.calls[0][2].auth.persistSession).toBe(false); expect(m.logout).toHaveBeenCalledWith({ scope: "global" });
});
it("cleans up recovery sessions if password update is rejected, including additional MFA requirements", async () => {
  m.update.mockResolvedValue({ error: { message: "MFA required" } }); expect((await POST(req(reset))).status).toBe(400); expect(m.logout).toHaveBeenCalled();
});
it("does not reveal whether email exists and forwards CAPTCHA", async () => {
  m.send.mockResolvedValue({ error: { message: "unknown account" } });
  const response = await POST(req({ action: "request", email: "fixture@example.test", captchaToken: "fixture-captcha" }));
  expect(await response.json()).toEqual({ ok: true }); expect(m.send).toHaveBeenCalledWith("fixture@example.test", { captchaToken: "fixture-captcha" }); expect(m.update).not.toHaveBeenCalled();
});
it("requires persistent throttling before verifying or sending", async () => {
  m.limit.mockResolvedValue(60); const response = await POST(req(reset)); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60"); expect(m.create).not.toHaveBeenCalled();
  m.limit.mockRejectedValue(Error("private")); expect((await POST(req(reset))).status).toBe(503);
});

it("requires an existing verified authenticator before updating an enrolled account", async () => {
  m.factors.mockResolvedValue({ data: { all: [{ id: "factor", factor_type: "totp", status: "verified" }] }, error: null });
  expect((await POST(req(reset))).status).toBe(400); expect(m.update).not.toHaveBeenCalled();
  expect((await POST(req({ ...reset, code: "123456" }))).status).toBe(200);
  expect(m.challenge).toHaveBeenCalledWith({ factorId: "factor", code: "123456" });
  m.update.mockClear(); m.challenge.mockResolvedValue({ error: {} });
  expect((await POST(req({ ...reset, code: "123456" }))).status).toBe(400); expect(m.update).not.toHaveBeenCalled();
});
