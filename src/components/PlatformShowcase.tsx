import Image from 'next/image';
import Link from 'next/link';
import type {Locale} from '@/lib/content';
import {advertisingPlatforms,platformCopy} from '@/lib/platforms';
import styles from './PlatformShowcase.module.css';
export default function PlatformShowcase({locale}:{locale:Locale}){
 const t=platformCopy(locale);return <section className={`section wrap ${styles.platforms}`} id="platforms"><p className="eyebrow">{t.label}</p><div className={styles.heading}><h2>{t.title}<br/><em>{t.titleAccent}</em></h2><p className={styles.lead}>{t.intro}</p></div><div className={styles.cards}>{advertisingPlatforms.map((p,i)=>{const copy=p[locale];return <article key={p.slug} className={`${styles.card} ${p.focus?styles.focus:''}`}><div className={styles.cardTop}><div className={styles.logoBox}><Image src={p.logo} alt={`${p.name} logo`} width={36} height={36}/></div><span className={styles.index}>0{i+1}</span></div><p className={styles.platformName}>{p.name}<span className={styles.category}>{copy.category}</span></p><h3>{copy.slogan}</h3><p className={styles.description}>{copy.description}</p><p className={styles.keywords}>{copy.keywords.join(' · ')}</p><span className={styles.badge}>{p.focus?t.focus:t.consultation}</span><Link className={styles.cardLink} href={`/${locale}/platforms/${p.slug}`}>{t.explore}<span aria-hidden="true">↗</span></Link></article>;})}</div><p className={styles.scope}>{t.scope}</p><p className={styles.trademark}>{t.trademark}</p></section>;
}
