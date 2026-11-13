import { notFound } from "next/navigation";
import PasswordRecovery from "@/components/admin/PasswordRecovery";
import { getStaffLoginConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "密码恢复 | 智点未来", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Recovery({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (locale !== "zh" && locale !== "en") notFound();
  const config = getStaffLoginConfig();
  return <main className="admin-auth"><h1>{locale === "zh" ? "恢复账户密码" : "Recover account password"}</h1><PasswordRecovery locale={locale} enabled={Boolean(config)} siteKey={config?.siteKey || ""} /></main>;
}
