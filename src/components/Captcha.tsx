"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/content";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; language: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      remove: (id: string) => void;
    };
  }
}
export default function Captcha({ siteKey, locale, onToken }: { siteKey: string; locale: Locale; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready || !container.current || !window.turnstile) return;
    const id = window.turnstile.render(container.current, {
      sitekey: siteKey, language: locale === "zh" ? "zh-cn" : "en",
      callback: token => { setFailed(false); onToken(token); },
      "expired-callback": () => onToken(""),
      "error-callback": () => { onToken(""); setFailed(true); },
    });
    return () => { window.turnstile?.remove(id); };
  }, [ready, siteKey, locale, onToken]);
  return <div className="captcha"><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setFailed(true)} /><div ref={container} />{failed && <p role="alert">{locale === "zh" ? "安全验证暂时不可用，请稍后重试。" : "Security verification is unavailable. Please try again later."}</p>}</div>;
}
