import type { Metadata } from "next";
import {clientStatementReturnTo} from "@/lib/auth/client-return";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PhoneLogin from "@/components/PhoneLogin";
import { getAuthConfig } from "@/lib/auth/config";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{flow?:string;returnTo?:string}> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "zh" ? "客户登录 | 智点未来" : "Client sign-in | 智点未来", robots: { index: false, follow: false } };
}
export default async function Login({ params, searchParams }: Props) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();
  const zh = locale === "zh";
  const query=await searchParams;const applicationFlow=query.flow === "application";
  const returnTo=applicationFlow?null:clientStatementReturnTo(query.returnTo,locale);
  const config = getAuthConfig();
  const steps = zh ? [
    ["输入手机号", "默认 +86，填写 11 位中国大陆手机号码。"],
    ["短信验证", "通过短信验证码完成身份验证，无需设置密码。"],
    ["进入客户中心", "验证后关联客户公司，仅能查看所属公司的项目与广告数据。"],
  ] : [
    ["Enter your number", "Use an 11-digit mainland China mobile number with the default +86 code."],
    ["Verify by SMS", "Use a text-message verification code instead of a password."],
    ["Access your client center", "After verification, link your client organization to access only its projects and advertising data."],
  ];
  return <><SiteHeader locale={locale} path={applicationFlow ? "/login?flow=application" : returnTo?`/login?${new URLSearchParams({returnTo})}`:"/login"} /><main id="main" className="section wrap login-page"><div><p className="eyebrow">{zh ? "智点未来 客户中心" : "智点未来 CLIENT CENTER"}</p><h1>{zh ? <>您的全球业务，<br /><em>一个入口。</em></> : <>Your global business.<br /><em>One place to begin.</em></>}</h1><p className="detail-intro">{zh ? "为中国出海企业设计的客户入口，默认简体中文。客户中心将逐步提供项目沟通、广告报告与业务进展。" : "A client entry point designed for Chinese businesses expanding internationally. Simplified Chinese is the default, with English available. Project communication and advertising reports are planned for the client center."}</p><ol className="login-steps">{steps.map(([title, description], index) => <li key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{description}</p></div></li>)}</ol><div className="workflow-preview-switch"><a className="service-link" href={`/${locale}/apply`}>{zh?"首次合作？了解企业申请流程":"New client? Explore the application process"} ↗</a><a className="service-link" href={`/${locale}/admin/login`}>{zh?"员工登录":"Staff sign-in"} ↗</a></div></div><PhoneLogin returnTo={returnTo} applicationFlow={applicationFlow} locale={locale} enabled={Boolean(config)} siteKey={config?.siteKey || ""} codeLength={config?.codeLength || 6} /></main><SiteFooter locale={locale} /></>;
}
