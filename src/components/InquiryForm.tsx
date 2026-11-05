"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { content, type Locale } from "@/lib/content";
export default function InquiryForm({locale}: {locale: Locale}) {
 const t = content[locale]; const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); if (busy) return; const form = e.currentTarget; const data = new FormData(form); setBusy(true); setStatus("");
  try { const res = await fetch("/api/inquiries", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({company:data.get("company"), email:data.get("email"), message:data.get("message"), consent:data.get("consent")==="on", locale, website:data.get("website")})});
   setStatus(res.ok ? t.success : res.status===503 ? t.unavailable : res.status===400 ? t.invalid : t.error); if(res.ok) form.reset();
  } catch { setStatus(t.error); } finally { setBusy(false); }
 }
 return <form onSubmit={submit} className="inquiry-form">
 <label>{t.company}<input name="company" required minLength={2} maxLength={160} autoComplete="organization" /></label>
 <label>{t.email}<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
 <label>{t.message}<textarea name="message" required minLength={10} maxLength={4000} rows={4} /></label>
 <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
 <label className="consent"><input type="checkbox" name="consent" required />{t.consent}</label>
 <button disabled={busy} className="button" type="submit">{busy?t.sending:t.send}<span aria-hidden="true">↗</span></button>
 <p role="status" aria-live="polite">{status}</p><small>{t.privacy} <Link href={`/${locale}/privacy`}>{locale === "zh" ? "阅读隐私说明" : "Read privacy notice"} ↗</Link></small>
 </form>;
}
