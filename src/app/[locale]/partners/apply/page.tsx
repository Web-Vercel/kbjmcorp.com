import {notFound} from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import InquiryForm from '@/components/InquiryForm';
import {partners} from '@/lib/partners';
import styles from '@/components/PartnersSection.module.css';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return {title:locale==='en'?'Partner application | 智点未来':'合作伙伴申请 | 智点未来'};}
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const t=partners[locale];return <><SiteHeader locale={locale} path="/partners/apply"/><main id="main" className={`wrap ${styles.application}`}><Link className="service-link" href={`/${locale}#partners`}>← {t.label}</Link><p className="eyebrow">{t.label}</p><h1>{t.apply}</h1><p>{t.formIntro}</p><div className={styles.formWrap}><InquiryForm locale={locale} purpose="partner"/></div><p>{t.terms}</p></main><SiteFooter locale={locale}/></>}
