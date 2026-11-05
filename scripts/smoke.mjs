import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
const slugs = ["strategy", "creative", "media", "insights"];
let checks = 0;
async function page(path, expectedLanguage, marker) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(`lang="${expectedLanguage}"`), `${path}: document language`);
  assert.ok(html.includes(marker), `${path}: localized content`);
  checks++;
  return html;
}
const redirect = await fetch(base, { redirect: "manual" });
assert.equal(redirect.status, 307);
assert.equal(redirect.headers.get("location"), "/zh");
checks++;
for (const locale of ["zh", "en"]) {
  const lang = locale === "zh" ? "zh-CN" : "en";
  const home = await page(`/${locale}`, lang, locale === "zh" ? "让中国品牌，" : "Chinese brands.");
  assert.ok(home.includes("ChatGPT") && home.includes("智点未来"), "Updated advertising positioning is present");
  assert.ok(home.includes('value="global"'), "Global market choice is present");
  assert.ok(home.includes(locale === "zh" ? "ChatGPT 广告代理服务" : "ChatGPT advertising agency"), "ChatGPT agency service is localized");
  assert.ok(!home.includes("KBJM"), "Old brand labels are removed");
  assert.ok(!home.includes(locale === "zh" ? "聊聊您的出海计划" : "Discuss your global plans"), "Removed hero CTA stays absent");
  assert.ok(home.includes(locale === "zh" ? "您可能想了解的事。" : "A few useful answers."), "Localized FAQ is present");
  assert.ok(home.includes('name="phone"'), "Phone contact input is present");
  for (const slug of slugs) {
    assert.ok(home.includes(`href="/${locale}/services/${slug}"`));
    const html = await page(`/${locale}/services/${slug}`, lang, locale === "zh" ? "可讨论的交付范围" : "Potential scope");
    const other = locale === "zh" ? "en" : "zh";
    assert.ok(html.includes(`href="/${other}/services/${slug}"`), "Language switch retains service");
    assert.ok(html.includes(`href="/${locale}#contact"`), "Inquiry CTA returns to localized form");
  }
  await page(`/${locale}/privacy`, lang, locale === "zh" ? "开发草案" : "DEVELOPMENT DRAFT");
  const login = await page(`/${locale}/login`, lang, locale === "zh" ? "手机号登录" : "Sign in with your phone");
  assert.ok(login.includes("+86"), "Mainland country code is visible");
  assert.ok(login.includes('maxLength="11"'), "Phone input is limited to eleven digits");
  assert.ok(login.includes(`href="/${locale === "zh" ? "en" : "zh"}/login"`), "Language switch retains login route");
  assert.ok(login.includes(locale === "zh" ? "不发送短信" : "No messages are sent"), "Disabled login does not claim SMS is enabled");
  assert.ok(home.includes(`href="/${locale}/login"`), "Home exposes the client login entry");
}
for (const path of ["/fr", "/en/services/missing", "/zh/does-not-exist"]) {
  assert.equal((await fetch(new URL(path, base))).status, 404, path);
  checks++;
}
const valid = { company: "Smoke Test Ltd", email: "smoke@example.com", message: "International advertising consultation", locale: "en", consent: true, website: "" };
async function post(body, expected, headers = {}) {
  const response = await fetch(new URL("/api/inquiries", base), {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body,
  });
  assert.equal(response.status, expected, `inquiry expected ${expected}`);
  checks++;
}
await post("{", 400);
await post("{}", 400);
await post(JSON.stringify({ ...valid, email: "", phone: "" }), 400);
await post(JSON.stringify({ ...valid, consent: false }), 400);
await post(JSON.stringify({ ...valid, email: "invalid" }), 400);
await post(JSON.stringify({ ...valid, website: "https://spam.example" }), 400);
await post("x".repeat(16385), 413);
await post(JSON.stringify(valid), 403, { Origin: "https://unrelated.example" });
await post(JSON.stringify(valid), 415, { "Content-Type": "text/plain" });
// This smoke suite intentionally targets an UNCONFIGURED database environment.
// It must never send test inquiries to a live database.
if (process.env.SMOKE_EXPECT_UNCONFIGURED === "1") {
  await post(JSON.stringify(valid), 503);
  await post(JSON.stringify({ ...valid, email: "", phone: "13800138000", market: "global" }), 503);
}
for (const locale of ["zh", "en"]) {
  const response = await fetch(new URL(`/${locale}/account`, base), { redirect: "manual" });
  assert.equal(response.status, 307, "Anonymous client center request redirects");
  assert.equal(response.headers.get("location"), `/${locale}/login`);
  checks++;
}
// Auth endpoint checks do not contact a live provider.
for (const [route, data, expected] of [
  ["sms", { phone: "123", consent: true, captchaToken: "fixture" }, 400],
  ["verify", { phone: "13800138000", code: "123" }, 400],
]) {
  const response = await fetch(new URL(`/api/auth/${route}`, base), { method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(base).origin }, body: JSON.stringify(data) });
  assert.equal(response.status, expected);
  checks++;
}
console.log(`Passed ${checks} route and inquiry checks.`);
