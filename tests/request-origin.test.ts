import { afterEach, expect, it, vi } from "vitest";
import { hasSameOrigin } from "@/lib/http/request-origin";
afterEach(() => vi.unstubAllEnvs());
it("matches browser origin to public Host rather than Next's listener hostname", () => {
  expect(hasSameOrigin(new Request("http://localhost:3003/api/auth/sms", { headers: { Host: "127.0.0.1:3003", Origin: "http://127.0.0.1:3003" } }))).toBe(true);
});
it("rejects unrelated origins and absent origins on auth endpoints", () => {
  expect(hasSameOrigin(new Request("https://site.example", { headers: { Host: "site.example", Origin: "https://other.example" } }))).toBe(false);
  expect(hasSameOrigin(new Request("https://site.example"))).toBe(false);
});
it("uses the trusted Vercel protocol for HTTPS termination", () => {
  vi.stubEnv("VERCEL", "1");
  expect(hasSameOrigin(new Request("http://localhost/api", { headers: { Host: "site.example", Origin: "https://site.example", "x-forwarded-proto": "https" } }))).toBe(true);
});
it("does not trust forwarded protocol headers outside the managed deployment", () => {
  vi.stubEnv("VERCEL", "");
  expect(hasSameOrigin(new Request("http://localhost/api", { headers: { Host: "site.example", Origin: "https://site.example", "x-forwarded-proto": "https" } }))).toBe(false);
});
