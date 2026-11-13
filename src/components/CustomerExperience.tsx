import type {Locale} from '@/lib/content';
import styles from './CustomerExperience.module.css';

const copy = {
 zh: {
  label: '清晰管理，专注投放',
  title: '从预算到报告，服务环环相连。',
  items: [
   ['资金管理清楚', '到账经核对，广告费与服务费分别列明，余额与账单可查。'],
   ['业务流程贯通', '需求、报价、投放跟进与月度报告集中管理，减少重复沟通。'],
   ['各方权责明确', '客户、销售与财务按角色协作，收费依约确认，重要账务独立复核。'],
   ['投放优化有据', '结合目标市场设计素材与投放方案，通过表现数据评估与调整。'],
  ],
  note: '具体功能与服务以实际开通及双方约定为准；广告表现受市场与平台等因素影响。',
 },
 en: {
  label: 'CLEAR MANAGEMENT. FOCUSED DELIVERY.',
  title: 'From budget to reporting, a connected service.',
  items: [
   ['Clear fund records', 'Receipts are verified, ad charges and service fees are itemized separately, and balances and statements are available for review.'],
   ['A connected workflow', 'Manage briefs, quotes, campaign follow-up and monthly reports together to reduce repeated communication.'],
   ['Defined responsibilities', 'Clients, sales and finance work within their roles. Charges follow agreed terms, with independent review of key financial steps.'],
   ['Data-informed optimization', 'Design creative and campaigns for the target market, then use performance data to evaluate and adjust.'],
  ],
  note: 'Features and service scope depend on activation and agreed terms. Advertising performance is affected by market and platform conditions.',
 },
};

export default function CustomerExperience({locale}: {locale: Locale}) {
 const t = copy[locale];
 return <section id="client-experience" className={`section wrap ${styles.section}`}>
  <header className={styles.heading}>
   <p className="eyebrow">{t.label}</p>
   <h2>{t.title}</h2>
  </header>
  <div className={styles.items}>{t.items.map(([title, body]) =>
   <article key={title}><h3>{title}</h3><p>{body}</p></article>
  )}</div>
  <p className={styles.note}>{t.note}</p>
 </section>;
}
