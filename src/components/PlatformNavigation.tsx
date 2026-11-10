import Image from 'next/image';
import Link from 'next/link';
import {advertisingPlatforms,platformCopy} from '@/lib/platforms';
import type {Locale} from '@/lib/content';
import styles from './PlatformShowcase.module.css';
export default function PlatformNavigation({locale,path}:{locale:Locale;path:string}){
 return <div className={styles.rail}><div className={`wrap ${styles.railInner}`}><span className={styles.railLabel}>{platformCopy(locale).label}</span><nav className={styles.railLinks} aria-label={locale==='zh'?'广告平台导航':'Advertising platform navigation'}>{advertisingPlatforms.map(p=><Link className={styles.railLink} key={p.slug} href={`/${locale}/platforms/${p.slug}`} aria-current={path===`/platforms/${p.slug}`?'page':undefined}><Image src={p.logo} alt="" width={24} height={24}/><span>{p.name}</span><span className={styles.railArrow} aria-hidden="true">↗</span></Link>)}</nav></div></div>;
}
