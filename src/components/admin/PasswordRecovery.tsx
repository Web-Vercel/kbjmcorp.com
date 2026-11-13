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
      else setMessage(zh ? "未能完成。链接可能已失效、已使用，或账户需要额外验证。请重新申请或联系管理员。" : "Unable to complete. The link may be expired or used, or additional verification is required. Request a new link or contact your administrator.");
    } catch { setMessage(zh ? "连接失败，请稍后重试。" : "Connection failed. Try later."); }
    finally { lock.current = false; setBusy(false); setCaptcha(""); setVersion(v => v + 1); }
  }
  return <><p>{zh ? "通过账户邮箱恢复密码。财务职责及验证器设置保持有效。" : "Recover your password through your account email. Assigned duties and authenticator settings remain in effect."}</p>{!done && <form className="admin-form" onSubmit={submit}>{token ? <><label>{zh ? "新密码（至少12个字符）" : "New password (at least 12 characters)"}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><label>{zh ? "确认新密码" : "Confirm password"}<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><label>{zh ? "现有验证器验证码（已绑定的账户必填）" : "Existing authenticator code (required if enrolled)"}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}/></label><small>{zh ? "链接只能使用一次。请先准备验证码；失败后需申请新邮件。" : "Links are single-use. Have your code ready; request a new email after a failed attempt."}</small></> : <><label>{zh ? "账户邮箱" : "Account email"}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>{enabled && <Captcha key={version} locale={locale} siteKey={siteKey} onToken={onToken} />}</>}<button className="button" disabled={busy || !enabled}>{busy ? (zh ? "处理中…" : "Working…") : token ? (zh ? "设置新密码" : "Set password") : (zh ? "发送恢复邮件" : "Send recovery email")}</button></form>}<p role="status">{message}</p>{!enabled && <p>{zh ? "密码恢复暂不可用，请联系管理员。" : "Recovery is unavailable. Contact your administrator."}</p>}<Link href={`/${locale}/admin/login`}>{zh ? "返回内部登录" : "Return to staff sign-in"}</Link>{(done || token) && <p><a href={`/${locale}/auth/recovery`}>{zh ? "重新申请恢复邮件" : "Request another recovery email"}</a></p>}</>;
}
