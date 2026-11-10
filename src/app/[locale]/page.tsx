import PlatformShowcase from '@/components/PlatformShowcase';
import Link from "next/link";
import { notFound } from "next/navigation";
import { content } from "@/lib/content";
import InquiryForm from "@/components/InquiryForm";
import Faq from "@/components/Faq";
import HeroVisual from "@/components/HeroVisual";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { serviceSlugs } from "@/lib/services";
export function generateStaticParams(){return [{locale:"zh"},{locale:"en"}];}
export async function generateMetadata({params}: {params:Promise<{locale:string}>}){const {locale}=await params; return {title:locale==="en"?"智点未来 | ChatGPT Advertising & AI Marketing":"智点未来 | ChatGPT 广告与 AI 营销",description:locale==="en"?"ChatGPT advertising strategy, creative production, campaign management and performance analysis for Chinese businesses reaching overseas customers.":"智点未来以 ChatGPT 广告投放服务为核心，为中国企业提供广告策略规划、创意制作、投放管理及效果分析，连接全球营销机遇。",alternates:{languages:{"zh-CN":"/zh",en:"/en"}}};}
export default async function Page({params}: {params:Promise<{locale:string}>}) {
 const {locale}=await params; if(locale!=="zh"&&locale!=="en")notFound(); const t=content[locale];
 return <><SiteHeader locale={locale}/> <main id="main"><section className="hero-stage"><div className="hero wrap"><div className="hero-copy"><p className="eyebrow"><span className="dot"/>{t.tag}</p><h1>{t.headline[0]}<br/><em>{t.headline[1]}</em></h1><div className="hero-description"><p className="intro">{t.intro}</p><p className="intro">{t.introSecondary}</p></div><div className="actions"><a className="text-link" href="#services">{t.secondary} ↓</a></div></div><HeroVisual locale={locale}/></div><svg className="hero-wave" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0C230 180 380 170 570 130S830 130 960 180H0Z" fill="#edf7e6"/><path d="M0 92C200 180 330 180 485 155S710 80 910 180H0Z" fill="#f5faef"/></svg></section>
 <div className="market-strip"><div className="wrap market-inner"><p>{t.market}</p>{t.markets.map(m=><span key={m}>{m}<b aria-hidden="true">↗</b></span>)}</div></div>
 <PlatformShowcase locale={locale}/>
 <section className="section wrap" id="services"><p className="eyebrow">{t.serviceLabel}</p><div className="section-heading"><h2>{t.serviceTitle}</h2><p>{t.serviceIntro}</p></div><div className="services">{t.services.map(([n,title,desc,meta],i)=><article key={n}><div className="card-top"><span>{n}</span><span aria-hidden="true">↗</span></div><h3>{title}</h3><p>{desc}</p><small>{meta}</small><Link className="service-link" href={`/${locale}/services/${serviceSlugs[i]}`}>{locale==="zh"?"了解服务":"Explore service"} ↗</Link></article>)}</div></section>
 <section className="process" id="process"><div className="section wrap"><p className="eyebrow">{t.processLabel}</p><h2>{t.processTitle}</h2><div className="steps">{t.steps.map(([title,desc],i)=><article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></div></section>
 <Faq locale={locale}/><section className="section wrap contact" id="contact"><div><p className="eyebrow">{t.contactLabel}</p><h2>{t.contactTitle}</h2><p>{t.contactText}</p><div className="contact-mark" aria-hidden="true">Let’s<br/><em>go global.</em><span>↗</span></div></div><InquiryForm locale={locale}/></section></main>
 <SiteFooter locale={locale}/></>;
}
