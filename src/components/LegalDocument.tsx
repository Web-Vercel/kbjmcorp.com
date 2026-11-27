import Link from 'next/link';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import {legalContent,legalUpdated} from '@/lib/legal-content';
import type {Locale} from '@/lib/content';
export default function LegalDocument({locale,document}:{locale:Locale;document:'privacy'|'terms'}){
 const policy=legalContent[locale][document];const zh=locale==='zh';const other=document==='privacy'?'terms':'privacy';
 return <><SiteHeader locale={locale} path={`/${document}`}/><main id="main" className="section wrap detail-page privacy-page"><p className="eyebrow">智点未来</p><h1>{policy.title}</h1><p>{zh?'更新日期：':'Last updated: '}{legalUpdated}</p><p className="detail-intro">{policy.intro}</p><p><Link href={`/${locale}/${other}`}>{legalContent[locale][other].title} ↗</Link></p>{policy.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}<p>{zh?'联系：':'Contact: '}<a href="mailto:info@kbjmcorp.com">info@kbjmcorp.com</a></p></main><SiteFooter locale={locale}/></>;
}
