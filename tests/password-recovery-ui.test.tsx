// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/components/Captcha", () => ({ default: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" onClick={() => onToken("fixture-captcha")}>Verify fixture</button> }));
import Recovery from "@/components/admin/PasswordRecovery";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
it("removes recovery secrets from URL and submits only after password confirmation", async () => {
  const token = "a".repeat(64); window.history.replaceState(null, "", `/zh/auth/recovery?token_hash=${token}&type=recovery`);
  const fetcher = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetcher);
  render(<Recovery locale="zh" enabled siteKey="fixture" />);
  expect(window.location.search).toBe("");
  fireEvent.change(screen.getByLabelText("新密码（至少12个字符）"), { target: { value: "fixture-password" } });
  fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "other-password" } });
  fireEvent.click(screen.getByText("设置新密码")); expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("确认新密码"), { target: { value: "fixture-password" } });
  fireEvent.click(screen.getByText("设置新密码"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("密码已更新"));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: "reset", token, password: "fixture-password" });
});
it("does not accept an access-token fragment as recovery authority", () => {
  window.history.replaceState(null, "", "/en/auth/recovery#access_token=fixture&type=recovery");
  render(<Recovery locale="en" enabled siteKey="fixture" />);
  expect(window.location.hash).toBe(""); expect(screen.queryByLabelText("New password (at least 12 characters)")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Invalid recovery link");
});
it("shows an actionable MFA error and permits retry on the same page", async () => {
  window.history.replaceState(null,"",`/zh/auth/recovery?token_hash=${'b'.repeat(64)}&type=recovery`);
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,json:async()=>({error:'mfa_required'})}).mockResolvedValueOnce({ok:true});vi.stubGlobal('fetch',fetcher);
  render(<Recovery locale="zh" enabled siteKey="fixture"/>);
  fireEvent.change(screen.getByLabelText('新密码（至少12个字符）'),{target:{value:'fixture-password'}});fireEvent.change(screen.getByLabelText('确认新密码'),{target:{value:'fixture-password'}});
  fireEvent.click(screen.getByText('设置新密码'));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('六位验证码'));
  fireEvent.change(screen.getByLabelText('现有验证器验证码（已绑定的账户必填）'),{target:{value:'123456'}});fireEvent.click(screen.getByText('设置新密码'));
  await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('密码已更新'));expect(fetcher).toHaveBeenCalledTimes(2);
});
