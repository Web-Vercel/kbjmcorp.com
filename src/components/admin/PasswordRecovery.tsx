"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Captcha from "@/components/Captcha";
import type { Locale } from "@/lib/content";
export default function PasswordRecovery({ locale, enabled, siteKey }: { locale: Locale; enabled: boolean; siteKey: string }) {
  const zh = locale === "zh";
  const [token, setToken] = useState(""); const [captcha, setCaptcha] = useState("");
  const [version, setVersion] = useState(0); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""); const [done, setDone] = useState(false);
  const lock = useRef(false); const onToken = useCallback((value: string) => setCaptcha(value), []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = url.searchParams.get("token_hash");
    if (url.searchParams.get("type") === "recovery" && hash && /^[a-fA-F0-9]{40,128}$/.test(hash)) setToken(hash);
    else if (url.search || url.hash) setMessage(zh ? "恢复链接无效，请重新申请。" : "Invalid recovery link. Request a new one.");
    window.history.replaceState(null, "", url.pathname);
  }, [zh]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || !enabled) return;
    const form = new FormData(event.currentTarget);
    if (token && form.get("password") !== form.get("confirm")) { setMessage(zh ? "两次密码不一致。" : "Passwords do not match."); return; }
    if (!token && !captcha) { setMessage(zh ? "请完成安全验证。" : "Complete security verification."); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000), body: JSON.stringify(token ? { action: "reset", token, password: form.get("password"), code: form.get("code") || undefined } : { action: "request", email: form.get("email"), captchaToken: captcha }) });
      if (response.ok) { setDone(true); setToken(""); setMessage(token ? (zh ? "密码已更新。请重新登录并完成验证器验证。" : "Password updated. Sign in again and complete authenticator verification.") : (zh ? "若邮箱对应可恢复的账户，你将收到邮件。请使用最新邮件；未收到可稍后重试或联系管理员。" : "If the account can be recovered, you will receive an email. Use the latest message; otherwise try later or contact your administrator.")); }
      else {
        const body = await response.json().catch(() => ({}));
        const errors: Record<string, [string, string]> = {
          invalid_recovery: ["恢复链接已失效或已使用，请申请新邮件。", "Recovery link expired or used. Request a new email."],
          mfa_required: ["请填写此账户现有验证器的六位验证码，再次提交即可。", "Enter this account’s existing six-digit authenticator code and retry."],
          invalid_code: ["验证码无效或已过期。请使用此账户验证器的最新验证码，在本页重试。", "Invalid or expired authenticator code. Retry here with a fresh code for this account."],
          same_password: ["新密码不能与当前密码相同。请换一个密码后重试。", "Choose a password different from your current password and retry."],
          weak_password: ["新密码未满足账户安全要求，请使用更强的密码后重试。", "Password does not meet account security requirements. Choose a stronger password."],
          rate_limited: ["操作过于频繁，请稍后重试。恢复验证有效期为十分钟。", "Too many attempts. Try later; recovery verification lasts ten minutes."],
          unsupported_factor: ["此账户的验证方式暂不支持密码恢复，请联系管理员。", "This account’s verification method requires administrator assistance."],
          reauthentication_required: ["账户要求额外身份确认，请联系管理员。", "Additional account verification is required. Contact your administrator."],
          factor_lookup_failed: ["暂时无法读取验证器设置，请在本页稍后重试。", "Unable to check authenticator settings. Retry here shortly."],
        };
        const text = errors[body.error];
        setMessage(text ? text[zh ? 0 : 1] : (zh ? "暂时无法完成密码更新，请稍后重试；若仍失败，请提供错误编号：" : "Unable to update password. Retry later; if it persists, provide error code: ") + (body.error === "password_update_failed" ? "password_update_failed" : body.error === "session_failed" ? "session_failed" : "unavailable"));
      }
    } catch { setMessage(zh ? "连接失败，请稍后重试。" : "Connection failed. Try later."); }
    finally { lock.current = false; setBusy(false); setCaptcha(""); setVersion(v => v + 1); }
  }
  return <><p>{zh ? "通过账户邮箱恢复密码。财务职责及验证器设置保持有效。" : "Recover your password through your account email. Assigned duties and authenticator settings remain in effect."}</p>{!done && <form className="admin-form" onSubmit={submit}>{token ? <><label>{zh ? "新密码（至少12个字符）" : "New password (at least 12 characters)"}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><label>{zh ? "确认新密码" : "Confirm password"}<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><label>{zh ? "现有验证器验证码（已绑定的账户必填）" : "Existing authenticator code (required if enrolled)"}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}/></label><small>{zh ? "邮件链接只验证一次；验证码或密码不符合要求时，可在本页十分钟内重试。" : "Email links are verified once. You can retry a code or password here within ten minutes."}</small></> : <><label>{zh ? "账户邮箱" : "Account email"}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>{enabled && <Captcha key={version} locale={locale} siteKey={siteKey} onToken={onToken} />}</>}<button className="button" disabled={busy || !enabled}>{busy ? (zh ? "处理中…" : "Working…") : token ? (zh ? "设置新密码" : "Set password") : (zh ? "发送恢复邮件" : "Send recovery email")}</button></form>}<p role="status">{message}</p>{!enabled && <p>{zh ? "密码恢复暂不可用，请联系管理员。" : "Recovery is unavailable. Contact your administrator."}</p>}<Link href={`/${locale}/admin/login`}>{zh ? "返回内部登录" : "Return to staff sign-in"}</Link>{(done || token) && <p><a href={`/${locale}/auth/recovery`}>{zh ? "重新申请恢复邮件" : "Request another recovery email"}</a></p>}</>;
}
