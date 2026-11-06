import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import OperatingModel from "@/components/operations/OperatingModel";
import OperationsPreview from "@/components/operations/OperationsPreview";
export const metadata:Metadata={title:'三方SaaS运营演示 | 智点未来',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/operations-preview"/><main id="main" className="wrap section client-workspace ops-content"><p className="eyebrow">{locale==='zh'?'加拿大执行 · 中国运营 · 广告企业客户':'CANADA FULFILMENT · CHINA OPERATIONS · ADVERTISING CLIENTS'}</p><h1>{locale==='zh'?'三方协同，一个清晰的平台。':'Three parties. One clear workspace.'}</h1><OperatingModel locale={locale}/><OperationsPreview locale={locale}/><Link className="service-link" href={`/${locale}/admin-preview`}>← {locale==='zh'?'员工后台演示':'Staff workspace preview'}</Link></main><SiteFooter locale={locale}/></>;}
