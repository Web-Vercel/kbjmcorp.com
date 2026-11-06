import Link from "next/link";
import ClaimInvites from "@/components/crm/ClaimInvites";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import SignOutButton from "@/components/SignOutButton";
import BillingDashboard from "@/components/billing/BillingDashboard";
import { loadBilling } from "@/lib/billing/data";
import ClientWorkspace from "@/components/client/ClientWorkspace";
import { requireClientPage } from "@/lib/client/page";
import { loadClientWorkspace } from "@/lib/client/data";
import { maskPhone } from "@/lib/auth/validation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "客户中心 | 智点未来", robots: { index: false, follow: false } };
export default async function Account({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params;
 if (locale !== "zh" && locale !== "en") notFound();
 const { client, user } = await requireClientPage(locale);
 const [workspace, billing] = await Promise.all([loadClientWorkspace(client, user.id), loadBilling(client)]);
 return <><SiteHeader locale={locale} path="/account"/><main id="main" className="section wrap client-workspace"><p className="eyebrow">{locale === "zh" ? "客户中心" : "CLIENT CENTER"}</p><h1>{locale === "zh" ? "账户资金清晰，每月花费有据。" : "Clear funds. Accountable monthly spending."}</h1><p>{maskPhone(user.phone)}</p><ClaimInvites locale={locale}/><Link className="service-link" href={`/${locale}/account/company`}>{locale === "zh" ? "企业资料与合同" : "Company records & contracts"} ↗</Link><details className="client-identity"><summary>{locale === "zh" ? "公司关联信息" : "Organization association details"}</summary><p>{locale === "zh" ? "公司关联基于已批准的手机号邀请与验证结果。未显示所属企业时，请联系业务人员核实授权。以下账户标识仅供支持查询。" : "Company association follows approved phone invitations and verification. Contact your representative if your company is missing. The identifier below is for support queries."}</p><code>{user.id}</code></details><BillingDashboard locale={locale} data={billing}/><details className="billing-supplement"><summary>{locale === "zh" ? "其他服务：项目进度与创意协作" : "Other services: projects and creative collaboration"}</summary><ClientWorkspace locale={locale} {...workspace}/></details><SignOutButton locale={locale}/></main><SiteFooter locale={locale}/></>;
}
