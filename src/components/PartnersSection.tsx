import Link from 'next/link';
import type {Locale} from '@/lib/content';
import styles from './PartnersSection.module.css';
export default function PartnersSection({locale}:{locale:Locale}){const zh=locale==='zh';return <section id="partners" className={`wrap ${styles.compact}`}><span id="process"/><div><h2>{zh?'合作模式':'Working together'}</h2><p>{zh?'面向销售、推荐人及营销服务机构，按约定明确客户服务、执行分工与结算方式。':'For sales representatives, referrers and marketing agencies, with agreed responsibilities, service scope and settlement terms.'}</p></div><Link className="service-link" href={`/${locale}/partners`}>{zh?'了解合作方式':'Explore partnership options'} ↗</Link></section>}
