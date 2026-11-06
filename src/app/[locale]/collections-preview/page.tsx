import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import CollectionsPreview from '@/components/collections/CollectionsPreview';
export const metadata:Metadata={title:'对公收款流程演示 | 智点未来',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/collections-preview"/><main id="main" className="wrap section client-workspace collections-content"><p className="eyebrow">{locale==='zh'?'企业收款 · 清晰账目 · 独立复核':'BUSINESS COLLECTIONS · CLEAR RECORDS · INDEPENDENT REVIEW'}</p><h1>{locale==='zh'?'先核实到账，再计入余额。':'Verify receipt. Then credit the balance.'}</h1><CollectionsPreview locale={locale}/><Link className="service-link" href={`/${locale}/admin-preview`}>← {locale==='zh'?'员工后台演示':'Staff workspace preview'}</Link></main><SiteFooter locale={locale}/></>;}
