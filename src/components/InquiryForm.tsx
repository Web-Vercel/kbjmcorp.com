"use client";
import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import {partners} from "@/lib/partners";
import { content, type Locale } from "@/lib/content";
import { inquirySchema, inquiryText, markets } from "@/lib/inquiry";

type ErrorField = keyof (typeof inquiryText)["zh"]["errors"];
export default function InquiryForm({ locale,purpose="general" }: { locale: Locale;purpose?:"general"|"partner" }) {
  const base=content[locale],partner=partners[locale];const t=purpose==="partner"?{...base,company:partner.company,message:partner.message,send:partner.apply,consent:partner.consent,success:locale==="zh"?"合作申请已收到，我们会通过您提供的联系方式联系。":"Partnership application received. We will respond using your contact details.",invalid:locale==="zh"?"请检查姓名或机构名称、联系方式和合作说明，并同意信息处理。":"Check your name or organization, contact details and partnership message, and agree to information processing."}:base; const originalLabels=inquiryText[locale];const labels=purpose==="partner"?{...originalLabels,email:locale==="zh"?"联系邮箱（选填）":"Contact email (optional)",contactHelp:locale==="zh"?"请至少提供手机号或邮箱，方便我们回复合作申请。":"Provide a phone number or email so we can respond to your partnership application.",errors:{...originalLabels.errors,company:locale==="zh"?"请填写 2–160 个字符的姓名、团队或公司名称。":"Enter a name, team or company of 2–160 characters."}}:originalLabels; const id = useId();
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({});
  const lock = useRef(false);
  function fieldError(field: ErrorField) { return errors[field] ? <span className="field-error" id={`${id}-${field}-error`}>{errors[field]}</span> : null; }
  function accessibility(field: ErrorField) { return { "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined }; }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget; const data = new FormData(form);
    const input = { company: data.get("company"), email: data.get("email"), phone: data.get("phone"), market: data.get("market"), message: data.get("message"), consent: data.get("consent") === "on", locale, website: data.get("website") };
    const parsed = inquirySchema.safeParse(input);
    setErrors({}); setStatus("");
    if (!parsed.success) {
      const next: Partial<Record<ErrorField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ErrorField;
        if (field in labels.errors) next[field] = labels.errors[field];
      }
      setErrors(next); setStatus(t.invalid);
      const first = Object.keys(next)[0];
      const element = first ? form.elements.namedItem(first) : null;
      if (element instanceof HTMLElement) element.focus();
      return;
    }
    lock.current = true; setBusy(true);
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(purpose==="partner"?{...parsed.data,message:`${partner.formPrefix}\n${parsed.data.message}`} : parsed.data) });
      setStatus(response.ok ? t.success : response.status === 503 ? t.unavailable : response.status === 400 ? t.invalid : t.error);
      if (response.ok) form.reset();
    } catch { setStatus(t.error); } finally { lock.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="inquiry-form" noValidate aria-busy={busy}>
    <label>{t.company}<input name="company" required minLength={2} maxLength={160} autoComplete="organization" {...accessibility("company")} />{fieldError("company")}</label>
    <p className="contact-help" id={`${id}-contact-help`}>{labels.contactHelp}</p>
    <div className="inquiry-contact-field"><label htmlFor={`${id}-phone`}>{labels.phone}</label><div className="inquiry-phone"><span aria-hidden="true">+86</span><input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" pattern="1[3-9][0-9]{9}" maxLength={11} autoComplete="tel-national" placeholder={labels.phonePlaceholder} {...accessibility("phone")} aria-describedby={`${id}-contact-help${errors.phone ? ` ${id}-phone-error` : ""}`} /></div>{fieldError("phone")}</div>
    <label>{labels.email}<input name="email" type="email" maxLength={254} autoComplete="email" {...accessibility("email")} />{fieldError("email")}</label>
    <label>{labels.market}<select name="market" defaultValue="undecided" {...accessibility("market")}>{markets.map((market, index) => <option key={market} value={market}>{labels.markets[index]}</option>)}</select>{fieldError("market")}</label>
    <label>{t.message}<textarea name="message" required minLength={10} maxLength={purpose==="partner"?3600:4000} rows={4} {...accessibility("message")} />{fieldError("message")}</label>
    <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="consent"><input type="checkbox" name="consent" required {...accessibility("consent")} /><span>{t.consent}{fieldError("consent")}</span></label>
    <button disabled={busy} className="button" type="submit">{busy ? t.sending : t.send}<span aria-hidden="true">↗</span></button>
    <p role="status" aria-live="polite">{status}</p><small>{t.privacy} <Link href={`/${locale}/privacy`}>{locale === "zh" ? "阅读隐私说明" : "Read privacy notice"} ↗</Link></small>
  </form>;
}
