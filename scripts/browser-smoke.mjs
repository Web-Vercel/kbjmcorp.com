import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [320, 375, 768, 1024, 1201, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/zh`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("让中国品牌，");
    await expect(page.locator(".hero .actions .button")).toHaveCount(0);
    await expect(page.locator('.hero-visual img[src="/images/openai.svg"]')).toHaveCount(1);
    assert.equal(await page.locator(".hero-visual img").evaluate(image => image.complete && image.naturalWidth > 0), true, "Restored ChatGPT symbol loaded");
    await expect(page.locator(".hero-visual .chatgpt-platform strong")).toHaveText("ChatGPT");
    await expect(page.locator(".hero-visual .chatgpt-features>div")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "ChatGPT 广告代理服务", exact: true })).toHaveCount(1);
    assert.equal((await page.locator("body").innerText()).includes("KBJM"), false, "Old public brand labels are removed");
    if (width < 851) {
      const toggle = page.getByRole("button", { name: /菜单/ });
      await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("navigation", { name: "手机导航" }).getByRole("link", { name: /常见问题/ }).click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page).toHaveURL(/#faq$/);
    }
    assert.equal(await page.evaluate(() => {
      const copy = document.querySelector(".hero-copy").getBoundingClientRect();
      const artwork = document.querySelector(".hero-visual .hero-artwork").getBoundingClientRect();
      return artwork.left >= copy.right || artwork.top >= copy.bottom;
    }), true, `Brand artwork does not overlap hero copy at ${width}px`);
    checks++;
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${base}/zh`, { waitUntil: "networkidle" });
  const question = page.getByText("需要多少预算？广告费和代理服务费怎么计算？", { exact: true });
  await question.click();
  await expect(page.getByText(/媒体投放预算与代理服务费用分别确认/)).toBeVisible();
  await page.getByText("广告账户、客户资料和数据如何管理？", { exact: true }).click();
  await expect(page.getByText(/客户平台按公司权限展示信息/)).toBeVisible();
  await expect(page.locator("#faq summary").last().locator(".faq-number")).toHaveText("10");
  checks++;
  // Only exercise a valid lead submission on an explicitly unconfigured local instance.
  if (process.env.SMOKE_EXPECT_UNCONFIGURED === "1") {
    await page.goto(`${base}/zh/login`, { waitUntil: "networkidle" });
    await expect(page.locator(".login-notice")).toContainText("尚未开放");
    await page.goto(`${base}/zh`, { waitUntil: "networkidle" });
    const form = page.locator("#contact form");
    await form.getByRole("button", { name: /发送合作咨询/ }).click();
    await expect(form.getByText("请填写 2–160 个字符的公司名称。", { exact: true })).toBeVisible();
    await form.getByLabel("公司名称", { exact: false }).fill("浏览器测试企业");
    await form.getByLabel("计划进入的市场").selectOption("global");
    await form.getByLabel("您的出海目标", { exact: false }).fill("我们希望讨论面向北美市场的广告创意及投放方案。");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: /发送合作咨询/ }).click();
    await expect(form.getByText("请填写有效的 11 位大陆手机号，或留下有效邮箱。", { exact: true })).toBeVisible();
    await form.getByLabel("联系电话（中国大陆）", { exact: true }).fill("13800138000");
    await form.getByRole("button", { name: /发送合作咨询/ }).click();
    await expect(form.getByRole("status")).toContainText("尚未配置");
    await expect(form.getByLabel("联系电话（中国大陆）", { exact: true })).toHaveValue("13800138000");
    checks++;
  }
  await page.goto(`${base}/en`, { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "A few useful answers." })).toBeVisible();
  checks++;
  await page.goto(`${base}/zh`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/kbjm-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/zh`, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/kbjm-desktop.png", fullPage: true });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  console.log(`Passed ${checks} browser scenarios across six viewport sizes; screenshots saved under /tmp.`);
} finally { await browser.close(); }
