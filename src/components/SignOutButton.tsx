"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
export default function SignOutButton({ locale }: { locale: Locale }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  async function signOut() {
    if (busy) return; setBusy(true); setError(false);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      router.replace(`/${locale}/login`); router.refresh();
    } catch { setError(true); setBusy(false); }
  }
  return <div><button className="button" disabled={busy} onClick={signOut}>{locale === "zh" ? "退出登录" : "Sign out"}</button>{error && <p role="alert">{locale === "zh" ? "退出未完成，请重试。" : "Sign-out failed. Please try again."}</p>}</div>;
}
