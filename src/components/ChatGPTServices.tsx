import Link from 'next/link';
import type {Locale} from '@/lib/content';
import {chatgptServiceCopy} from '@/lib/chatgpt-services';
import styles from './ChatGPTServices.module.css';
export default function ChatGPTServices({locale}:{locale:Locale}){
 const t=chatgptServiceCopy(locale);
 return <section id="chatgpt-services" className={'section wrap '+styles.section} aria-labelledby="chatgpt-services-title"><span id="services" aria-hidden="true"/><div className={styles.heading}><p className="eyebrow">{t.label}</p><h2 id="chatgpt-services-title">{t.title}</h2><p>{t.intro}</p></div><div className={styles.cards}>{[t.ads,t.commerce].map(s=><article className={styles.card} key={s.eyebrow}><p className={styles.eyebrow}>{s.eyebrow}</p><h3>{s.title}</h3><p>{s.short}</p><ul>{s.items.map(item=><li key={item}>{item}</li>)}</ul><Link className={styles.link} href={'/'+locale+s.href}>{s.cta}<span aria-hidden="true">↗</span></Link></article>)}</div><p className={styles.scope}>{t.scope}</p><details className={styles.comparison}><summary>{t.compareTitle}</summary><div className={styles.tableScroll} role="region" aria-label={t.compareTitle} tabIndex={0}><table className={styles.table}><thead><tr>{t.columns.map(col=><th scope="col" key={col}>{col}</th>)}</tr></thead><tbody>{t.rows.map(([label,ads,commerce])=><tr key={label}><th scope="row">{label}</th><td>{ads}</td><td>{commerce}</td></tr>)}</tbody></table></div></details></section>;
}
