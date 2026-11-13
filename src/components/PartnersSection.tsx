import Link from 'next/link';
import type {Locale} from '@/lib/content';
import {partners} from '@/lib/partners';
import styles from './PartnersSection.module.css';

const summaries = {
 zh: [
  '开发企业客户，协助确认需求并促成签约。',
  '推荐潜在客户，后续沟通与投放由智点未来跟进。',
  '面向服务机构，通过客户推荐与联合服务开展合作。',
  '以合作方品牌服务客户，智点未来提供约定的后台运营支持。',
  '通过内容与推广渠道推荐服务，推广方式按协议约定。',
 ],
 en: [
  'Develop business clients, clarify their needs and support contracting.',
  'Refer potential clients; 智点未来 follows up on discussions and campaign delivery.',
  'For service providers working together through referrals and joint client service.',
  'Serve clients under your brand, with agreed operational support from 智点未来.',
  'Recommend services through content and promotional channels under agreed terms.',
 ],
};

export default function PartnersSection({locale}: {locale: Locale}) {
 const t = partners[locale];
 const zh = locale === 'zh';
 return <section id="partners" className={styles.homeSection} aria-labelledby="partners-title">
  <span id="process" className={styles.legacyAnchor} aria-hidden="true"/>
  <div className="section wrap">
   <div className={styles.homeHeading}><h2 id="partners-title">{t.label}</h2><p>{zh?'根据资源与服务分工，选择适合的合作方式。':'Choose a model that fits your resources and service responsibilities.'}</p></div>
   <div className={styles.models}>{t.models.map((model, i) =>
    <article key={model.name} className={`${styles.model} ${styles.homeModel}`}>
     <span className={styles.number}>{String(i + 1).padStart(2, '0')}</span>
     <h3>{model.name}</h3>{model.en && <small>{model.en}</small>}
     <p>{summaries[locale][i]}</p>
    </article>
   )}</div>
   <div className={styles.homeLinks}>
    <Link className="service-link" href={`/${locale}/partners`}>{zh?'了解合作详情':'Partnership details'} ↗</Link>
    <Link className="service-link" href={`/${locale}/partners/apply`}>{zh?'申请合作':'Apply to partner'} ↗</Link>
   </div>
   <p className={styles.terms}>{t.terms}</p>
  </div>
 </section>;
}
