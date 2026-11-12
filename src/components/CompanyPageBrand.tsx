import Link from 'next/link';
import BrandLogo from './BrandLogo';
import type {Locale} from '@/lib/content';
import styles from './CompanyPageBrand.module.css';
/** Shared fallback for application pages without an existing branded header/sidebar. */
export default function CompanyPageBrand({locale}:{locale:Locale}){
 return <div className={styles.corner} data-company-page-brand="true"><Link className={styles.link} href={`/${locale}`} aria-label={locale==='zh'?'智点未来首页':'Zhidian Future home'}><BrandLogo/></Link></div>;
}
