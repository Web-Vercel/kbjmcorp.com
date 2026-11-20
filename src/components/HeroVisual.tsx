import Image from 'next/image';
import Link from 'next/link';
import type {Locale} from '@/lib/content';
import {chatgptServiceCopy} from '@/lib/chatgpt-services';
import styles from './HeroVisual.module.css';
export default function HeroVisual({locale}:{locale:Locale}){
 const zh=locale==='zh',t=chatgptServiceCopy(locale);
 return <aside className={'hero-visual chatgpt-visual '+styles.visual} aria-label={zh?'ChatGPT 广告与电商服务':'ChatGPT advertising and commerce services'}>
  <div className="hero-halo" aria-hidden="true"/><div className="brand-orbit brand-orbit-one" aria-hidden="true"/><div className="brand-orbit brand-orbit-two" aria-hidden="true"/>
  <div className={styles.card}><div className={styles.top}><span><i aria-hidden="true"/>{zh?'AI 对话中的生意机会':'BUSINESS OPPORTUNITIES IN AI'}</span><span aria-hidden="true">✦</span></div>
   <div className={styles.brand}><div className={styles.logo}><Image src="/images/openai.svg" alt="" width={48} height={48}/></div><div><strong>ChatGPT</strong><p>{zh?'广告获客 · 电商商品接入':'Advertising · Commerce integration'}</p></div></div>
   <div className={styles.services}>{[t.ads,t.commerce].map(s=><Link className={styles.service} key={s.eyebrow} href={'/'+locale+s.href}><small>{s.eyebrow}</small><strong>{s.title}</strong><p>{s.short}</p><span className={styles.arrow} aria-hidden="true">↗</span></Link>)}</div>
   <div className={styles.bottom}><span>{zh?'从品牌触达，到商品发现':'From brand reach to product discovery'}</span><Link href={'/'+locale+'#chatgpt-services'}>{zh?'比较两项服务':'Compare services'} ↓</Link></div>
  </div>
 </aside>;
}
