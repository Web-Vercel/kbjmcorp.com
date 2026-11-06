import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import WorkflowPreview from "@/components/workflow/WorkflowPreview";
export const metadata: Metadata = { title: "项目协作演示 | 智点未来", robots: { index: false, follow: false } };
export default async function Preview({ params }: { params: Promise<{ locale: string }> }) {
 const { locale } = await params; if (locale !== "zh" && locale !== "en") notFound();
 return <><SiteHeader locale={locale} path="/workflow-preview"/><main id="main" className="section wrap client-workspace"><p className="eyebrow">{locale === "zh" ? "虚构项目 · 交互演示" : "FICTIONAL PROJECT · INTERACTIVE DEMO"}</p><h1>{locale === "zh" ? "从推广需求，到创意确认。" : "From campaign brief to creative approval."}</h1><WorkflowPreview locale={locale}/><Link className="service-link" href={`/${locale}/client-preview`}>← {locale === "zh" ? "客户中心演示" : "Client center preview"}</Link></main><SiteFooter locale={locale}/></>;
}
