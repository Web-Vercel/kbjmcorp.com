import Link from 'next/link';
import {attentionHref,tasks,type Attention} from '@/lib/attention/model';
import styles from './HomeAttention.module.css';
type Bucket='attention'|'action'|'waiting';
const buckets:Bucket[]=['attention','action','waiting'];
function StatusIcon({bucket}:{bucket:Bucket}){return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{bucket==='attention'?<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></>:bucket==='action'?<><circle cx="12" cy="12" r="9"/><path d="M8 12h8m-3-3 3 3-3 3"/></>:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}</svg>}
export default function HomeAttention({data,locale,showWorkflowNote=true}:{showWorkflowNote?:boolean;data:Attention|null;locale:'zh'|'en'}){
 const zh=locale==='zh',labels={action:zh?'需要你处理':'Your actions',waiting:zh?'等待他人或流程推进':'Waiting for others or workflow',attention:zh?'需要关注':'Needs attention'};
 const groups=buckets.map(bucket=>({bucket,items:data?.items.filter(i=>i.bucket===bucket)||[]}));
 return <section className={styles.panel} aria-labelledby="home-attention-title">
  <div className={styles.heading}><h2 id="home-attention-title">{zh?'待办与提醒':'Tasks and reminders'}</h2><span>{zh?'本次查询结果 · 刷新更新':'Current query · Refresh to update'}</span></div>
  {!data?<p role="alert">{zh?'待办暂不可用，请刷新重试；可继续通过下方菜单查看工作，不能据此判断没有待办。':'Reminders are unavailable. Refresh to retry or use the menus below; this does not mean no tasks remain.'}</p>:<>
   <div className={styles.summary} aria-label={zh?'待办分类概览':'Reminder categories'}>{groups.map(({bucket,items})=>{
    const className=`${styles.tile} ${styles[bucket]} ${items.length?styles.active:styles.empty}`;
    const content=<><span className={styles.tileHeading}><span className={styles.icon}><StatusIcon bucket={bucket}/></span><span>{labels[bucket]}</span>{items.length>0&&<span className={styles.jump} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 5 14 14m0-9v9h-9"/></svg></span>}</span><span className={styles.tileStatus}>{items.length?<><strong data-workspace-value>{items.length}</strong><span>{zh?'组事项':'groups'}</span></>:<><span className={styles.emptyCheck} aria-hidden="true">✓</span><span>{zh?'暂无事项':'No items'}</span></>}</span>{items.length>0&&<span className={styles.tileHint}>{bucket==='action'?(zh?'现在可以办理':'Ready for your action'):bucket==='attention'?(zh?'请先查看原因':'Check the issue first'):(zh?'查看进度，无需重复提交':'Track progress; do not resubmit')}</span>}</>;
    return items.length?<a key={bucket} className={className} href={`#home-attention-${bucket}`}>{content}</a>:<div key={bucket} className={className}>{content}</div>;
   })}</div>
   {!data.items.length&&<p className={styles.allClear}>{zh?'当前查询未发现待办事项。':'No matching items in this query.'}</p>}
   {groups.filter(g=>g.items.length).map(({bucket,items})=><div key={bucket} id={`home-attention-${bucket}`} className={`${styles.group} ${styles[bucket]}`}>
    <h3><span className={styles.icon}><StatusIcon bucket={bucket}/></span>{labels[bucket]}</h3>
    <ul>{items.map((item,i)=><li key={item.key+(item.org||'')+i}><Link href={attentionHref(item,locale)}><div><strong>{tasks[item.key][zh?0:1]}</strong>{item.company&&<span data-workspace-value>{item.company}</span>}<small>{zh?'最早记录：':'Earliest record: '}{new Intl.DateTimeFormat(zh?'zh-CN':'en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(item.oldest))}{zh?'（北京时间）':' (Beijing)'}</small></div><span className={styles.rowEnd}><span className={styles.count} data-workspace-value>{item.count}</span><span className={styles.open}>{bucket==='action'?(zh?'去处理':'Open task'):(zh?'查看':'View')}<span aria-hidden="true"> →</span></span></span></Link></li>)}</ul>
   </div>)}
   {data.totalGroups>data.items.length&&<p>{zh?'仅显示前200组事项，请进入相关页面查看其余记录。':'Showing the first 200 groups; open the relevant workspace for remaining records.'}</p>}
   {showWorkflowNote&&<p className={styles.note}>{zh?'仅提示现有流程，不会自动审批、扣款或付款；等待项无需重复提交。':'Reminders do not approve, charge or pay. Do not resubmit waiting items.'}</p>}
  </>}
 </section>;
}
