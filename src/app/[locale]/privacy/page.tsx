import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "zh" ? "隐私说明（开发草案） | KBJM" : "Privacy notice (development draft) | KBJM", robots: { index: false, follow: false } };
}
export default async function Privacy({ params }: Props) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();
  const zh = locale === "zh";
  const sections = zh ? [
    ["我们请求的信息", "咨询表单请求公司名称、手机号或邮箱、目标市场和咨询内容，并记录所选语言与同意时间。手机号与邮箱至少提供一项；咨询手机号仅用于后续沟通，不会触发验证码或注册账户。请勿提交密码、支付信息、广告平台密钥或敏感个人信息。"],
    ["未来的手机登录", "客户账户计划使用 +86 中国大陆手机号与短信验证码验证。短信未启用时不发送短信或创建账户。启用后，手机号将交由 Supabase Auth 和所选短信服务商用于发送验证码及账户验证；限流记录使用手机号的带密钥摘要。验证码不写入业务数据库。正式启用前需确认服务商、保留期限及账户隐私条款。"],
    ["处理目的", "这些信息用于评估需求、回复本次咨询及开展后续合作沟通。提交咨询不会自动创建客户账户或订阅营销邮件。"],
    ["服务与存储", "计划使用独立的 Supabase 项目存储咨询。当前开发版本尚未接入数据库；未配置时会明确提示提交不可用。"],
    ["发布前待确认", "数据控制者的完整法律名称、隐私联系渠道、存储区域、保留期限、服务提供方及跨境处理安排需要在正式开放收集前确认。正式版本也需要说明访问、更正和删除请求的处理方式。"],
  ] : [
    ["Information requested", "The inquiry form requests your company name, phone number or email, target market and message, and records your chosen language and consent time. At least one contact method is required. An inquiry phone number is for follow-up, not SMS verification or automatic registration. Do not submit passwords, payment details, advertising platform keys or sensitive personal information."],
    ["Planned phone sign-in", "Client accounts are planned to use +86 mainland China phone numbers and SMS verification. While SMS is disabled, no texts are sent or accounts created. Once enabled, Supabase Auth and the selected SMS provider process phone numbers for verification. Rate-limit records use keyed phone digests; codes are not stored in business tables. Providers, retention and final account terms must be confirmed before activation."],
    ["Purpose", "This information supports reviewing your needs, responding to this inquiry and discussing potential work. Submitting an inquiry does not automatically create a client account or subscribe you to marketing emails."],
    ["Services and storage", "The planned storage is a separate Supabase project. This development version is not connected to a database and explicitly reports that submission is unavailable when unconfigured."],
    ["Required before release", "The controller’s full legal name, privacy contact, storage region, retention period, service providers and cross-border processing arrangements must be confirmed before collection opens. The final notice must also explain how access, correction and deletion requests are handled."],
  ];
  return <><SiteHeader locale={locale} path="/privacy" /><main id="main" className="section wrap detail-page privacy-page"><p className="eyebrow">{zh ? "开发草案 · 待发布前审核" : "DEVELOPMENT DRAFT · REVIEW REQUIRED BEFORE RELEASE"}</p><h1>{zh ? "隐私说明" : "Privacy notice"}</h1><p className="detail-intro">{zh ? "本页说明当前咨询流程与待确认事项，并非已审核的正式隐私政策。" : "This page describes the current inquiry flow and outstanding decisions. It is not a reviewed final privacy policy."}</p>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</main><SiteFooter locale={locale} /></>;
}
