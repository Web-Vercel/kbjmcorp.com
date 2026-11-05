import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { isServiceSlug, serviceDetails, serviceSlugs } from "@/lib/services";

type Props = { params: Promise<{ locale: string; slug: string }> };
export function generateStaticParams() {
  return ["zh", "en"].flatMap(locale => serviceSlugs.map(slug => ({ locale, slug })));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if ((locale !== "zh" && locale !== "en") || !isServiceSlug(slug)) notFound();
  const detail = serviceDetails[locale][slug];
  return { title: `${detail.title} | KBJM`, description: detail.summary, alternates: { languages: { "zh-CN": `/zh/services/${slug}`, en: `/en/services/${slug}` } } };
}
export default async function ServicePage({ params }: Props) {
  const { locale, slug } = await params;
  if ((locale !== "zh" && locale !== "en") || !isServiceSlug(slug)) notFound();
  const detail = serviceDetails[locale][slug];
  const zh = locale === "zh";
  return <>
    <SiteHeader locale={locale} path={`/services/${slug}`} />
    <main id="main" className="wrap section detail-page">
      <Link className="text-link" href={`/${locale}#services`}>← {zh ? "全部服务" : "All services"}</Link>
      <p className="eyebrow">{zh ? "服务能力 / KBJM" : "OUR CAPABILITIES / KBJM"}</p>
      <h1>{detail.title}</h1><p className="detail-intro">{detail.summary}</p>
      <div className="detail-grid">
        <section><h2>{zh ? "可讨论的交付范围" : "Potential scope"}</h2><ul className="deliverables">{detail.deliverables.map((item, i) => <li key={item}><span>0{i + 1}</span>{item}</li>)}</ul></section>
        <aside className="detail-aside"><h2>{zh ? "从这些信息开始" : "What helps us begin"}</h2><p>{detail.inputs}</p><p>{zh ? "具体交付物、时间与费用将在了解需求后书面约定，不承诺特定广告效果。" : "Deliverables, timing and fees are agreed in writing after discovery. Specific advertising results are not guaranteed."}</p><Link className="button" href={`/${locale}#contact`}>{zh ? "讨论合作需求" : "Discuss your project"}<span aria-hidden="true">↗</span></Link></aside>
      </div>
      <nav className="related-services" aria-label={zh ? "其他服务" : "Other services"}>{serviceSlugs.filter(item => item !== slug).map(item => <Link key={item} href={`/${locale}/services/${item}`}>{serviceDetails[locale][item].title} ↗</Link>)}</nav>
    </main>
    <SiteFooter locale={locale} />
  </>;
}
