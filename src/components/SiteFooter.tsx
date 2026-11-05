import Link from "next/link";
import { content, type Locale } from "@/lib/content";

export default function SiteFooter({ locale }: { locale: Locale }) {
  return <footer className="wrap footer">
    <div><strong>KBJM</strong><p>{content[locale].footer}</p></div>
    <span>© {new Date().getFullYear()} KBJM</span>
    <Link href={`/${locale}/privacy`}>{locale === "zh" ? "隐私说明" : "Privacy notice"} ↗</Link>
  </footer>;
}
