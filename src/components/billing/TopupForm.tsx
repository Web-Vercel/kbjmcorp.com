"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toMinor, type Currency } from "@/lib/billing/model";
export default function TopupForm({ locale, walletId, currency, onDemoRequest }: { locale: "zh" | "en"; walletId: string; currency: Currency; onDemoRequest?: (minor: string, reference: string) => void }) {
 const zh = locale === "zh"; const router = useRouter(); const lock = useRef(false);
 const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); if (lock.current) return;
  const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
  lock.current = true; setBusy(true); setMessage("");
  try {
   const minor = toMinor(String(values.amount));
   if (onDemoRequest) onDemoRequest(minor, String(values.reference));
   else {
    const response = await fetch("/api/billing/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, walletId }) });
    if (!response.ok) { setMessage(response.status === 409 ? (zh ? "此付款参考号已登记，请查看记录。" : "This reference is already registered.") : (zh ? "申请未保存，请确认财务权限并稍后重试。" : "Not saved. Check finance access and try again.")); return; }
    router.refresh();
   }
   form.reset(); setMessage(zh ? "已登记为待核对。核实实际到账前，余额不会增加。" : "Registered for verification. Your balance will not increase until receipt is verified.");
  } catch { setMessage(zh ? "未保存，请检查金额并重试。" : "Not saved. Check the amount and try again."); }
  finally { lock.current = false; setBusy(false); }
 }
 return <form className="admin-form billing-topup-form" onSubmit={submit}><p className="workflow-byline">{zh ? "请先通过业务渠道与财务确认收款方式。此处登记已安排的付款，用于到账核对；不执行在线支付。" : "Confirm payment instructions with your finance contact first. Register an arranged payment here for verification; this form does not process online payments."}</p><label>{zh ? `充值金额（${currency}）` : `Top-up amount (${currency})`}<input name="amount" inputMode="decimal" required pattern="[0-9]{1,8}(\.[0-9]{1,2})?" placeholder="0.00"/></label><label>{zh ? "付款参考号" : "Payment reference"}<input name="reference" required minLength={3} maxLength={120}/></label><label className="admin-checkbox"><input type="checkbox" name="confirm" required/>{zh ? "我理解此申请需核实实际到账，不会立即增加余额。" : "I understand this request requires receipt verification and does not immediately credit the balance."}</label><button className="button" disabled={busy}>{busy ? (zh ? "提交中…" : "Submitting…") : (zh ? "提交充值核对" : "Request top-up verification")}</button><p role="status" aria-live="polite">{message}</p></form>;
}
