"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { content, type Locale } from "@/lib/content";

export default function MobileNavigation({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = `mobile-navigation-${locale}`;
  useEffect(() => {
    if (!open) return;
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    }
    function outside(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", keydown);
    document.addEventListener("mousedown", outside);
    return () => { document.removeEventListener("keydown", keydown); document.removeEventListener("mousedown", outside); };
  }, [open]);
  const links = [
    ...content[locale].nav.map((label, index) => ({ label, href: `/${locale}${["#services", "#process", "#contact"][index]}` })),
    { label: locale === "zh" ? "常见问题" : "FAQ", href: `/${locale}#faq` },
  ];
  return <div className="mobile-navigation" ref={root}>
    <button className="menu-toggle" ref={toggle} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{locale === "zh" ? "菜单" : "Menu"}<span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <nav id={id} className="mobile-menu" aria-label={locale === "zh" ? "手机导航" : "Mobile navigation"}>
      {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<span aria-hidden="true">↗</span></Link>)}
    </nav>}
  </div>;
}
