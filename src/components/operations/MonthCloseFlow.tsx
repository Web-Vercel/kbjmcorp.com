import Link from 'next/link';
import {closeAction,closeStages,type CloseAccount} from '@/lib/operations/month-close';
import type {MainFlowStep} from '@/lib/operations/main-flow';
import styles from './MonthCloseFlow.module.css';

function Status({kind,zh}:{kind:'done'|'pending'|'problem'|'waiting'|'unknown';zh:boolean}){
 const names={done:['已完成','Complete'],pending:['待处理','To do'],problem:['需要检查','Needs attention'],waiting:['尚未开始','Not started'],unknown:['状态待确认','Status unknown']};
 return <span className={styles.status} data-status={kind}><span className={styles.dot} aria-hidden="true"/>{names[kind][zh?0:1]}</span>;
}
export default function MonthCloseFlow({accounts,context,locale,company,month,summary,fundingAvailable}:{accounts:CloseAccount[];context:{owner:boolean;canPrepare:boolean;canReview:boolean};locale:'zh'|'en';company:string;month:string;summary:MainFlowStep[];fundingAvailable:boolean}){
 const zh=locale==='zh';
 const titles=zh?['取回广告数据','检查整月数据','准备报价','制作账单草稿','另一人检查','确认余额并发布','账单已发布']:['Collect ad data','Check the full month','Prepare quote','Prepare statement','Independent check','Check funds and publish','Statement published'];
 const roles=zh?['管理员','制单员／复核员','管理员','制单员','复核员（不能是制单人）','管理员','客户可查看']:['Administrator','Preparer / reviewer','Administrator','Preparer','Reviewer (not the preparer)','Administrator','Client can view'];
 const yourRole=context.owner?(zh?'管理员':'Administrator'):[context.canPrepare?(zh?'财务制单员':'Preparer'):null,context.canReview?(zh?'财务复核员':'Reviewer'):null].filter(Boolean).join(' / ');
 const who=zh?{owner:'管理员',prepare:'制单员',review:'另一位复核员',finance:'有到账核对权限的财务人员',none:'等待月份结束',view:'查看发布记录'}:{owner:'Administrator',prepare:'Preparer',review:'Another reviewer',finance:'Authorized finance staff',none:'Wait for month end',view:'View publication record'};
 const plain:Record<string,string>={account_metadata_needed:'先取回广告账户的信息。',month_open:'这个账户的月份还没结束，结束后再处理。',source_needed:'还缺这个月的完整广告数据。',handoff_needed:'数据已取回，管理员还需要交给财务。',source_invalid:'数据有差异，请管理员先查清楚。',coverage_needed:'请检查这个月的数据是否齐全。',coverage_review_needed:'整月数据的检查依据，正等待另一人确认。',quote_needed:'管理员需要准备一份与广告费用一致的报价。',preparation_needed:'数据和报价已准备好，制单员可以制作账单草稿。',quote_archived:'原报价已停用，请管理员先准备新版本。',settlement_rejected:'这份草稿已退回，需要补充或修正后重新提交。',settlement_review_needed:'草稿已做好，等待另一位复核员检查。',wallet_needed:'请管理员先开立这个企业的人民币资金账户。',funding_needed:'已入账余额不够，请财务先核对客户到账。',publication_ready:'另一人已检查通过，等待管理员确认发布。',published:'账单已发布，本次费用已从客户余额中扣除。'};
 const query=new URLSearchParams({company,month});
 return <section className={styles.panel} aria-label={zh?'月结流程图':'Month-close flowchart'}>
  <header><div><p className={styles.eyebrow}>{month} · {zh?'本月办理路线':'This month’s workflow'}</p><h2>{zh?'进度在哪里，下一步谁来做':'What happened, and who acts next'}</h2></div><span className={styles.role}>{zh?'你的职责：':'Your role: '}{yourRole}</span></header>
  <p>{zh?'沿着箭头看进度。点击入口只打开办理页面，保存、通过和发布仍需在原页面确认。':'Follow the arrows. Links open the original forms; saving, approving and publishing still require confirmation there.'}</p>
  <div className={styles.legend} aria-label={zh?'状态颜色说明':'Status legend'}>{(['done','pending','problem','waiting','unknown'] as const).map(kind=><Status key={kind} kind={kind} zh={zh}/>)}</div>
  {!accounts.length&&<p>{zh?'还没有关联广告账户。请管理员先确认这个企业使用哪个账户。':'No advertiser is linked yet. Ask the administrator to confirm this company’s account.'}</p>}
  {accounts.map(account=>{
   const current=closeStages[account.stage];const action=closeAction(account,context,locale,company,month);
   const canAct=action?.allowed&&(account.stage!=='funding_needed'||fundingAvailable);
   const published=account.stage==='published';
   const problem=['source_invalid','settlement_rejected','quote_archived'].includes(account.stage);
   return <article className={styles.account} key={account.binding_id}>
    <h3>{account.account_label}</h3>
    <ol className={styles.track} aria-label={zh?'账单办理步骤':'Statement workflow'}>{titles.map((title,i)=>{
     const completed=published||i+1<current.step;const active=!published&&i+1===current.step;
     return <li key={title} className={completed?styles.complete:active?(problem?styles.problem:styles.current):styles.waiting} aria-current={active?'step':undefined}><span className={styles.number}>{i+1}</span><strong>{title}</strong><small>{roles[i]}</small><Status kind={completed?'done':active?(problem?'problem':'pending'):'waiting'} zh={zh}/></li>;
    })}</ol>
    <div className={styles.task}><div><Status kind={published?'done':problem?'problem':'pending'} zh={zh}/><br/><strong>{published?(zh?'账单发布完成':'Statement published'):(zh?'现在需要处理':'Current task')}</strong><p>{zh?(plain[account.stage]||current.zh):current.en}</p><small>{zh?'下一步负责人：':'Responsible next: '}{action?who[action.who]:who.none}</small>{account.stage==='settlement_rejected'&&<p>{zh?'检查人已退回。管理员先另存修订报价，再由制单员重新制单；原记录保留。':'Returned by reviewer. The administrator saves a revised quote, then the preparer makes a new draft. Previous records remain.'}</p>}</div>{canAct?<Link className="button" href={action!.href}>{published?(zh?'查看发布记录':'View publication'):(zh?'办理这一步':'Open current task')}</Link>:<p>{zh?'这一步由上面的负责人处理，你可以继续查看进度。':'The responsible person handles this step. You can continue viewing progress.'}</p>}</div>
   </article>;
  })}
  <div className={styles.branches}><p>{zh?'账单发布以后，两边分别跟进，不必互相等待：':'After publication, these two tracks proceed separately:'}</p><div>{summary.filter(s=>s.id==='access'||s.id==='payments').map(step=><article key={step.id}><h3>{step.id==='access'?(zh?'↳ 客户看账单':'↳ Client reads statement'):(zh?'↳ 两家公司核对到账':'↳ Companies check receipts')}</h3><p><Status kind={step.state==='ready'?'done':step.state==='unknown'?'unknown':'pending'} zh={zh}/></p><small>{step.id==='access'?(zh?'客户亲自确认看过；管理员不能代点。':'The client confirms reading; administrators cannot do it for them.'):(zh?'财务登记、另一人检查；这里不会发起转账，也不再扣客户余额。':'Finance records it and another person checks. No transfer or additional client debit occurs here.')}</small><p><Link className="service-link" href={`/${locale}/operations/${step.id==='access'?'month-close':'upstream-payments'}?${query}${step.id==='access'?'#client-handoff':''}`}>{zh?'查看记录与下一步':'View records and next step'}</Link></p></article>)}</div></div>
  <details className={styles.guide}><summary>{zh?'谁负责什么？':'Who is responsible for what?'}</summary><p>{zh?'管理员准备报价、最后发布；制单员把来源和报价做成账单草稿；另一位复核员检查并通过或退回；客户查看自己的账单并确认看过。每个人只能使用自己账号已获准的功能。':'The administrator prepares quotes and publishes. The preparer builds drafts from sources and quotes. A different reviewer approves or returns them. Clients view and acknowledge their own statements. Existing account permissions determine available actions.'}</p><p>{zh?'余额是已确认入账的钱。查看流程不会扣款；发布账单时才按原规则检查并扣余额。':'Balance means confirmed posted funds. Viewing does not charge anything; publication checks and debits funds under the existing rules.'}</p></details>
 </section>;
}
