import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CRMPreview from "@/components/crm/CRMPreview";
export const metadata:Metadata={title:'企业客户CRM演示 | 智点未来',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/crm-preview"/><main id="main" className="section wrap client-workspace"><p className="eyebrow">CRM · {locale==='zh'?'客户生命周期':'CLIENT LIFECYCLE'}</p><h1>{locale==='zh'?'从企业建档，到授权客户。':'From company record to authorized client.'}</h1><CRMPreview locale={locale}/><Link className="service-link" href={`/${locale}/admin-preview`}>← {locale==='zh'?'员工后台演示':'Staff workspace preview'}</Link></main><SiteFooter locale={locale}/></>;}
