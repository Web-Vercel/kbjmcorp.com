import styles from './Progress.module.css';
const refund=[['requested','收到申请'],['prepared','核算'],['reviewed','独立复核'],['approved','批准安排'],['payment_pending','登记付款'],['paid','核实付款']];
const settlement=[['prepared','结算制单'],['reviewed','独立复核'],['approved','批准安排'],['payment_pending','登记付款'],['paid','核实付款']];
export default function Progress({status,kind}:{status:string;kind:'refund'|'settlement'}){
 if(status==='rejected'||status==='cancelled')return <p className={styles.stopped}>{status==='rejected'?'已退回；原记录保留。':'已取消，原记录保留。'}</p>;
 const list=kind==='refund'?refund:settlement,index=list.findIndex(([key])=>key===status);if(index<0)return null;
 return <ol className={styles.flow} aria-label={kind==='refund'?'退款处理进度':'结算处理进度'}>{list.map(([key,label],i)=><li key={key} aria-current={i===index+1?'step':undefined} aria-label={`${label}，${i<=index?'已完成':i===index+1?'待处理':'尚未开始'}`} className={i<=index?styles.done:i===index+1?styles.current:styles.waiting}><span aria-hidden="true"/>{label}</li>)}</ol>;
}
