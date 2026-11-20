'use client';
import {useCallback,useContext,useRef,useState} from 'react';
import ActionForm from './ActionForm';
import {RecordSwitchContext} from './RefundRecordSelector';
import styles from './RefundWorkspace.module.css';
export default function RefundPreparation({id}:{id:string}){
 const parent=useContext(RecordSwitchContext),locks=useRef(new Set<string>()),[locked,setLocked]=useState(false),[choice,setChoice]=useState(''),[dirty,setDirty]=useState(false);
 const update=useCallback((key:string,value:boolean)=>{if(value)locks.current.add(key);else locks.current.delete(key);setLocked(locks.current.size>0);parent?.(key,value);},[parent]);
 return <RecordSwitchContext.Provider value={update}><div className={styles.preparation}><label>办理操作<select value={choice} disabled={locked} onChange={e=>{if(dirty&&!window.confirm('切换操作将清除尚未提交的输入，是否继续？'))return;setChoice(e.target.value);setDirty(false);}}><option value="">请选择操作</option><option value="prepare">核算并提交复核</option><option value="reject">资料不足／需改金额，退回申请</option></select></label><div key={choice} onChange={()=>setDirty(true)}>{choice==='prepare'&&<><p>核实未结费用、原付款方、退款账户、手续费及重复退款。需改金额时请选择退回，不改写本申请金额。</p><ActionForm action="refund_prepare" data={{id}} button="完成核算，提交独立复核" noteLabel="未结费用、可退金额、原付款方及退款账户核实依据"/></>}{choice==='reject'&&<ActionForm action="refund_reject" data={{id}} button="退回并解除退款占用" noteLabel="给客户的退回说明"/>}</div></div></RecordSwitchContext.Provider>;
}
