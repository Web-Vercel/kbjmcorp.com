import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { content, type Locale } from "@/lib/content";

export default function SiteFooter({ locale }: { locale: Locale }) {
  return <footer className="wrap footer">
    <div><BrandLogo/><p>{content[locale].footer}</p></div>
    <span>© {new Date().getFullYear()} 智点未来</span>
    <Link href={`/${locale}/privacy`}>{locale === "zh" ? "隐私政策" : "Privacy Policy"} ↗</Link>
    <Link href={`/${locale}/terms`}>{locale === "zh" ? "条款及条件" : "Terms and Conditions"} ↗</Link>
  </footer>;
}
