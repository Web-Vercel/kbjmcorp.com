import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ApplicationPreview from '@/components/applications/ApplicationPreview';
export const metadata:Metadata={title:'企业申请流程演示 | 智点未来',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/application-preview"/><main id="main" className="wrap section client-workspace"><p className="eyebrow">{locale==='zh'?'企业申请 · 人工审核 · 明确授权':'APPLICATION · REVIEW · EXPLICIT AUTHORIZATION'}</p><h1>{locale==='zh'?'让合作申请，每一步清晰。':'A clear path from application to review.'}</h1><ApplicationPreview locale={locale}/><Link className="service-link" href={`/${locale}/apply`}>← {locale==='zh'?'企业申请说明':'Application overview'}</Link></main><SiteFooter locale={locale}/></>;}
