import Link from "next/link";
import BrandLogo from "./BrandLogo";
import MobileNavigation from "./MobileNavigation";
import { content, type Locale } from "@/lib/content";

export default function SiteHeader({ locale, path = "" }: { locale: Locale; path?: string }) {
  const t = content[locale];
  const other = locale === "zh" ? "en" : "zh";
  return <>
    <a href="#main" className="skip">{locale === "zh" ? "跳至正文" : "Skip to content"}</a>
    <header className="header wrap">
      <Link className="site-brand" href={`/${locale}`} aria-label={locale === "zh" ? "智点未来首页" : "智点未来 home"}><BrandLogo/></Link>
      <nav aria-label={locale === "zh" ? "主导航" : "Main navigation"}>
        {t.nav.map((label, i) => <Link key={label} href={`/${locale}${["#services", "#process", "#contact"][i]}`}>{label}</Link>)}
      </nav>
      <div className="header-actions"><Link className="client-login" href={`/${locale}/login`}>{locale === "zh" ? "客户登录" : "Client sign-in"}</Link>
      <Link className="language" href={`/${other}${path}`} lang={other === "zh" ? "zh-CN" : "en"}>{other === "en" ? "EN ⌄" : "中文 ⌄"}</Link><MobileNavigation locale={locale} /></div>
    </header>
  </>;
}
