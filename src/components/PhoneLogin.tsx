"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
import Captcha from "./Captcha";

export default function PhoneLogin({ locale, enabled, siteKey, codeLength, applicationFlow = false }: { applicationFlow?: boolean; locale: Locale; enabled: boolean; siteKey: string; codeLength: number }) {
  const zh = locale === "zh"; const router = useRouter();
  const [phone, setPhone] = useState(""); const [code, setCode] = useState("");
  const [sent, setSent] = useState(false); const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(""); const [captchaVersion, setCaptchaVersion] = useState(0);
  const [remaining, setRemaining] = useState(0); const lock = useRef(false);
  const onToken = useCallback((token: string) => setCaptchaToken(token), []);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);
  const text = {
    unavailable: zh ? "短信登录暂未开放，当前不会发送验证码。" : "SMS sign-in is not available. No code has been requested.",
    retry: zh ? "暂时无法完成操作，请稍后重试。" : "Unable to complete the request. Please try again later.",
    limited: zh ? "操作过于频繁，请等待后重试。" : "Too many attempts. Please wait before trying again.",
    invalid: zh ? "验证码不正确或已过期，请检查或重新获取。" : "The code is incorrect or expired. Check it or request a new one.",
  };
  async function requestCode() {
    if (lock.current || remaining > 0) return;
    if (!/^1[3-9]\d{9}$/.test(phone)) { setStatus(zh ? "请输入有效的 11 位中国大陆手机号码。" : "Enter a valid 11-digit mainland China mobile number."); return; }
    if (!enabled) { setStatus(text.unavailable); return; }
    if (!consent) { setStatus(zh ? "请先阅读并同意账户隐私说明。" : "Read and agree to the account privacy notice first."); return; }
    if (!captchaToken) { setStatus(zh ? "请先完成安全验证。" : "Complete the security verification first."); return; }
    lock.current = true; setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/auth/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, consent, captchaToken }) });
      if (response.ok) {
        setSent(true); setCode(""); setRemaining(60);
        setStatus(zh ? "验证码请求已受理，请查收短信。若未收到，可等待后重新获取。" : "Code request accepted. Check your messages; if it does not arrive, wait before requesting another.");
      } else {
        if (response.status === 429) setRemaining(Math.max(1, Math.min(3600, Number(response.headers.get("Retry-After")) || 60)));
        setStatus(response.status === 503 ? text.unavailable : response.status === 429 ? text.limited : text.retry);
      }
    } catch { setStatus(text.retry); }
    finally { setCaptchaToken(""); setCaptchaVersion(value => value + 1); lock.current = false; setBusy(false); }
  }
  async function verifyCode() {
    if (lock.current) return;
    if (!new RegExp(`^\\d{${codeLength}}$`).test(code)) { setStatus(text.invalid); return; }
    lock.current = true; setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
      if (!response.ok) { setStatus(response.status === 503 ? text.unavailable : response.status === 429 ? text.limited : text.invalid); return; }
      setCode(""); router.replace(`/${locale}/account${applicationFlow ? "/application" : ""}`); router.refresh();
    } catch { setStatus(text.retry); }
    finally { lock.current = false; setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void (sent ? verifyCode() : requestCode()); }
  return <form className="inquiry-form login-form" onSubmit={submit} aria-busy={busy}>
    <p className="login-badge">{zh ? "短信验证码登录" : "SMS VERIFICATION SIGN-IN"}</p>
    <h2>{zh ? "手机号登录" : "Sign in with your phone"}</h2>
    <p className="login-description">{zh ? "使用中国大陆手机号登录，无需设置密码。首次验证后可创建账户，公司数据需关联权限后才能访问。" : "Use a mainland China mobile number without a password. First verification can create an account; organization data requires assigned access."}</p>
    <label htmlFor="login-phone">{zh ? "中国大陆手机号" : "Mainland China mobile number"}</label>
    <div className="phone-field"><span aria-label={zh ? "国家代码 加八六" : "Country code plus eighty-six"}>+86</span><input id="login-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="1[3-9][0-9]{9}" maxLength={11} value={phone} readOnly={sent || busy} onChange={event => { setPhone(event.target.value.replace(/[^0-9]/g, "").slice(0, 11)); setStatus(""); }} aria-describedby="phone-help" placeholder={zh ? "请输入 11 位手机号" : "11-digit mobile number"}/></div>
    <p id="phone-help" className="field-help">{zh ? "仅支持 +86 中国大陆手机号码。" : "For +86 mainland China mobile numbers."}</p>
    {sent && <><label htmlFor="login-code">{zh ? "短信验证码" : "SMS verification code"}<input id="login-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${codeLength}}`} required maxLength={codeLength} value={code} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, codeLength))} autoFocus /></label><button className="text-link change-number" type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setStatus(""); }}>{zh ? "更换手机号" : "Change number"}</button></>}
    <label className="consent"><input type="checkbox" checked={consent} required disabled={sent || busy} onChange={event => setConsent(event.target.checked)} /><span>{zh ? "我已阅读并同意手机号验证及账户服务的" : "I agree to phone verification and account processing described in the "}<Link href={`/${locale}/privacy`}>{zh ? "隐私说明" : "privacy notice"}</Link>。</span></label>
    {enabled && <Captcha key={captchaVersion} siteKey={siteKey} locale={locale} onToken={onToken} />}
    <button className="button" type="submit" disabled={busy || (!sent && remaining > 0)}>{busy ? (zh ? "正在处理…" : "Processing…") : sent ? (zh ? "验证并登录" : "Verify & sign in") : remaining > 0 ? `${remaining}s` : (zh ? "获取短信验证码" : "Request SMS code")}<span aria-hidden="true">↗</span></button>
    {sent && <button className="text-link resend-code" type="button" disabled={busy || remaining > 0 || !captchaToken} onClick={() => void requestCode()}>{remaining > 0 ? (zh ? `${remaining} 秒后可重新获取` : `Request again in ${remaining}s`) : (zh ? "重新获取验证码" : "Request another code")}</button>}
    <p role="status" aria-live="polite">{status}</p>
    {!enabled && <p className="login-notice">{zh ? "短信登录尚未开放，不发送短信，也不创建账户。" : "SMS sign-in is not enabled. No messages are sent and no accounts are created."}</p>}
    <small>{zh ? "手机号验证不代表已获得客户公司或管理员权限。请勿向他人透露验证码。" : "Phone verification does not grant organization or administrator access. Never share your code."}</small>
  </form>;
}
