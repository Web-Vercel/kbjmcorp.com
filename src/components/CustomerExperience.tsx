'use client';

import {useState} from 'react';
import type {Locale} from '@/lib/content';
import styles from './CustomerExperience.module.css';

const copy={
 zh:{label:'预算与费用，一目了然',title:'钱到哪里，用在哪里。',intro:'到账、费用、余额与报告，在客户账户里清楚查看。',tabs:['钱到账了吗？','钱用在哪里？','账单怎么查？'],headings:['核对到账，再记入账户。','广告费与服务费，分开看。','从账单，查到每笔记录。'],captions:['付款通知不等于到账，核对后入账。','先确认收费约定，再按账单核对费用。','账单与广告报告分别查看，统计期间清楚标明。'],receipt:['付款通知','到账核对','账户记录'],usage:['账户记录','广告费用','服务费用','当前余额'],report:['客户账户','已发布账单','广告报告','收支记录'],foot:['到账有核对','费用有明细','报告可查阅'],note:'功能示意，非实际账户数据。具体功能与服务以实际开通及双方约定为准。',view:'客户账户 · 功能示意',hint:'选择一个问题，查看对应流程'},
 en:{label:'YOUR BUDGET, CLEARLY PRESENTED',title:'Know where your money goes.',intro:'View receipts, charges, balances and reports in your client account.',tabs:['Has it arrived?','What was it used for?','Where are my records?'],headings:['Verified before it is credited.','Ad charges and service fees, separately.','From statements to individual records.'],captions:['A payment notification is checked against the actual receipt before credit.','Agree on charges first, then review them against your statements.','Statements and campaign reports are separate, with clear reporting periods.'],receipt:['Payment notice','Receipt check','Account record'],usage:['Account records','Ad charges','Service fees','Current balance'],report:['Client account','Published bills','Ad reports','Transactions'],foot:['Verified receipts','Itemized charges','Accessible reports'],note:'Feature illustration; no actual account data. Availability and service scope depend on activation and agreed terms.',view:'CLIENT ACCOUNT · FEATURE ILLUSTRATION',hint:'Choose a question to see the process'}
};
function Icon({kind}:{kind:'wallet'|'check'|'document'|'ad'}){return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{kind==='wallet'?<><rect x="7" y="12" width="34" height="27" rx="5"/><path d="M9 12V9a3 3 0 0 1 3-3h23v6M32 23h9v10h-9a5 5 0 0 1 0-10Z"/><path d="M33 28h1"/></>:kind==='check'?<><circle cx="24" cy="24" r="17"/><path d="m16 24 6 6 11-12"/></>:kind==='ad'?<><path d="m9 20 25-10v28L9 29ZM34 19h5v10h-5M13 31l4 10h6l-4-8M9 20H5v9h4"/></>:<><path d="M12 5h17l8 8v30H12ZM29 5v10h8M19 23h11M19 30h11M19 37h7"/></>}</g></svg>}
export default function CustomerExperience({locale}:{locale:Locale}){
 const [selected,setSelected]=useState(1);const t=copy[locale];
 return <section id="client-experience" className={`section wrap ${styles.section}`}>
  <header className={styles.heading}><p className="eyebrow">{t.label}</p><h2>{t.title}</h2><p>{t.intro}</p></header>
  <div className={styles.explorer}>
   <div className={styles.tabs} role="tablist" aria-label={t.hint}>{t.tabs.map((label,i)=><button key={label} id={`money-tab-${i}`} type="button" role="tab" aria-selected={selected===i} aria-controls="money-panel" tabIndex={selected===i?0:-1} onClick={()=>setSelected(i)} onKeyDown={e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setSelected(next);document.getElementById(`money-tab-${next}`)?.focus();}}}><Icon kind={i===0?'wallet':i===1?'ad':'document'}/>{label}<span aria-hidden="true">↗</span></button>)}</div>
   <div id="money-panel" role="tabpanel" aria-labelledby={`money-tab-${selected}`} className={styles.panel} tabIndex={0}>
    <div className={styles.panelTop}><span className={styles.windowDots} aria-hidden="true"><i/><i/><i/></span><span>{t.view}</span></div>
    <h3>{t.headings[selected]}</h3>
    {selected===0?<ol className={styles.flow}>{t.receipt.map((label,i)=><li key={label}><span className={styles.iconBox}><Icon kind={i===1?'check':i===2?'document':'wallet'}/></span><strong>{label}</strong>{i<2&&<span className={styles.arrow} aria-hidden="true">→</span>}</li>)}</ol>:<div className={styles.branch}><div className={styles.source}><Icon kind={selected===1?'wallet':'document'}/><strong>{selected===1?t.usage[0]:t.report[0]}</strong></div><div className={styles.connector} aria-hidden="true"/><div className={styles.destinations}>{(selected===1?t.usage:t.report).slice(1).map((label,i)=><div key={label} className={styles.destination}><Icon kind={selected===1?(i===0?'ad':i===1?'document':'wallet'):'document'}/><strong>{label}</strong><span className={styles.recordLines} aria-hidden="true"><i/><i/></span></div>)}</div></div>}
    <p className={styles.caption}>{t.captions[selected]}</p>
   </div>
  </div>
  <ul className={styles.assurances}>{t.foot.map(label=><li key={label}><Icon kind="check"/>{label}</li>)}</ul>
  <p className={styles.note}>{t.note}</p>
 </section>;
}
