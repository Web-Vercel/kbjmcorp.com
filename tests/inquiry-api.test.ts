import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: () => ({ insert: fixture.insert }) }) }));
import { POST } from "@/app/api/inquiries/route";
import { inquirySchema } from "@/lib/inquiry";
const valid = { company: "示例企业", phone: "13800138000", email: "", message: "希望了解海外广告投放方案与服务内容。", locale: "zh", consent: true, market: "europe" };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("SUPABASE_SECRET_KEY", ""); vi.stubEnv("SUPABASE_URL", "https://fixture.example"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only"); fixture.insert.mockResolvedValue({ error: null }); });
afterEach(() => vi.unstubAllEnvs());
function request(data: unknown) { return new Request("https://site.example/api/inquiries", { method: "POST", headers: { Origin: "https://site.example", "Content-Type": "application/json" }, body: JSON.stringify(data) }); }
it("saves phone-only inquiries in international format without creating accounts", async () => {
  const response = await POST(request(valid)); expect(response.status).toBe(201);
  expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ email: null, phone_e164: "+8613800138000", target_market: "europe", consent_version: "inquiry-v2" }));
});
it("keeps email-only inquiries working", async () => {
  const response = await POST(request({ ...valid, phone: "", email: "test@example.com" })); expect(response.status).toBe(201);
  expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ email: "test@example.com", phone_e164: null }));
});
it.each([
  { ...valid, phone: "", email: "" }, { ...valid, phone: "123" }, { ...valid, market: "invalid" }, { ...valid, consent: false },
])("rejects invalid lead input before database writes: %j", async input => {
  expect(inquirySchema.safeParse(input).success).toBe(false); expect((await POST(request(input))).status).toBe(400); expect(fixture.insert).not.toHaveBeenCalled();
});
it("does not claim success if the database rejects the record", async () => {
  fixture.insert.mockResolvedValue({ error: { message: "private schema detail" } }); const response = await POST(request(valid));
  expect(response.status).toBe(502); expect(await response.text()).not.toContain("private schema detail");
});

it("accepts and saves the Global market choice", async () => {
  expect((await POST(request({ ...valid, market: "global" }))).status).toBe(201);
  expect(fixture.insert).toHaveBeenCalledWith(expect.objectContaining({ target_market: "global" }));
});
it('supports the new server secret while keeping inquiry payloads and public branding unchanged',async()=>{
 vi.stubEnv('SUPABASE_SECRET_KEY','sb_secret_TEST_SERVER_ONLY');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');expect((await POST(request(valid))).status).toBe(201);expect(fixture.insert).toHaveBeenCalledTimes(1);
});
it('fails closed on a malformed new server key instead of using the legacy fallback',async()=>{
 vi.stubEnv('SUPABASE_SECRET_KEY','SUPABASE_SECRET_KEY=sb_secret_TEST');expect((await POST(request(valid))).status).toBe(503);expect(fixture.insert).not.toHaveBeenCalled();
});
