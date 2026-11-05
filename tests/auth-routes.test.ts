import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), limit: vi.fn(), client: vi.fn(), send: vi.fn(), verify: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ getAuthConfig: mocks.config }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthLimit: mocks.limit }));
vi.mock("@/lib/auth/server", () => ({ authClient: mocks.client }));
import { POST as send } from "@/app/api/auth/sms/route";
import { POST as verify } from "@/app/api/auth/verify/route";
import { POST as logout } from "@/app/api/auth/logout/route";
const phone = "13800138000";
const payload = { phone, consent: true, captchaToken: "fixture-captcha" };
function request(path: string, data: unknown, origin: string | null = "https://site.example") {
  return new Request(`https://site.example/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(data) });
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.config.mockReturnValue({ codeLength: 6 }); mocks.limit.mockResolvedValue(0);
  mocks.client.mockResolvedValue({ auth: { signInWithOtp: mocks.send, verifyOtp: mocks.verify, signOut: mocks.signOut } });
  mocks.send.mockResolvedValue({ error: null }); mocks.verify.mockResolvedValue({ data: { user: { id: "user" }, session: { access_token: "fixture" } }, error: null }); mocks.signOut.mockResolvedValue({ error: null });
});
describe("SMS request", () => {
  it("requires explicit same-origin browser requests", async () => {
    expect((await send(request("sms", payload, null))).status).toBe(403);
    expect((await send(request("sms", payload, "https://other.example"))).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each([{ ...payload, phone: "123" }, { ...payload, consent: false }, { ...payload, captchaToken: "" }])("rejects invalid input before sending: %j", async input => {
    expect((await send(request("sms", input))).status).toBe(400); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send when disabled", async () => {
    mocks.config.mockReturnValue(null); expect((await send(request("sms", payload))).status).toBe(503); expect(mocks.limit).not.toHaveBeenCalled();
  });
  it("limits sending before contacting the provider", async () => {
    mocks.limit.mockResolvedValue(45); const response = await send(request("sms", payload));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("45"); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("fails closed when persistent rate limiting is unavailable", async () => {
    mocks.limit.mockRejectedValue(new Error("database unavailable")); expect((await send(request("sms", payload))).status).toBe(503); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("normalizes +86, forwards CAPTCHA and requests self-service signup", async () => {
    const response = await send(request("sms", payload)); expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith({ phone: "+8613800138000", options: { shouldCreateUser: true, captchaToken: "fixture-captcha" } });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("does not return private provider errors or falsely claim success", async () => {
    mocks.send.mockResolvedValue({ error: { status: 500, message: "private provider diagnostic" } }); const response = await send(request("sms", payload));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("private provider diagnostic");
  });
});
describe("OTP verification and logout", () => {
  it("checks code shape and configured length", async () => {
    for (const code of ["1", "ABCDEF", "1234567"]) expect((await verify(request("verify", { phone, code }))).status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("does not authenticate while configuration is missing", async () => {
    mocks.config.mockReturnValue(null); expect((await verify(request("verify", { phone, code: "123456" }))).status).toBe(503);
  });
  it("requires a genuine verified session and never returns tokens", async () => {
    const response = await verify(request("verify", { phone, code: "123456" })); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true }); expect(mocks.verify).toHaveBeenCalledWith({ phone: "+8613800138000", token: "123456", type: "sms" });
  });
  it("rejects expired or incorrect codes", async () => {
    mocks.verify.mockResolvedValue({ data: { user: null, session: null }, error: { message: "expired" } });
    expect((await verify(request("verify", { phone, code: "123456" }))).status).toBe(400);
  });
  it("limits guessing independently from SMS sends", async () => {
    mocks.limit.mockResolvedValue(120); expect((await verify(request("verify", { phone, code: "123456" }))).status).toBe(429); expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("signs out only on a same-origin POST", async () => {
    expect((await logout(request("logout", {}, null))).status).toBe(403); expect(mocks.signOut).not.toHaveBeenCalled();
    expect((await logout(request("logout", {}))).status).toBe(200); expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("bounds streamed bodies and rejects invalid JSON", async () => {
    const big = new Request("https://site.example/api/auth/sms", { method: "POST", headers: { Origin: "https://site.example", "Content-Type": "application/json" }, body: "x".repeat(8193) });
    expect((await send(big)).status).toBe(413);
    const bad = new Request("https://site.example/api/auth/sms", { method: "POST", headers: { Origin: "https://site.example", "Content-Type": "application/json" }, body: "{" });
    expect((await send(bad)).status).toBe(400);
  });
});
