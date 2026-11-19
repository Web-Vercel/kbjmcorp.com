'use client';
import {createContext,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import styles from './RefundWorkspace.module.css';
export const RecordSwitchContext=createContext<((id:string,locked:boolean)=>void)|null>(null);
export default function RefundRecordSelector({items,locale}:{items:{id:string;label:string;active:boolean;actions?:ReactNode;content:ReactNode}[];locale:'zh'|'en'}){
 const zh=locale==='zh',initial=items.find(i=>i.active)?.id??items[0]?.id??'', [selected,setSelected]=useState(initial),[dirty,setDirty]=useState(false),[locked,setLocked]=useState(false),locks=useRef(new Set<string>());
 const updateLock=useCallback((id:string,value:boolean)=>{if(value)locks.current.add(id);else locks.current.delete(id);setLocked(locks.current.size>0);},[]);
 const current=items.find(i=>i.id===selected)??items.find(i=>i.id===initial);
 useEffect(()=>{const target=window.location.hash.replace(/^#refund-/,'');if(items.some(i=>i.id===target))setSelected(target);},[]); // Preserve saved direct links on initial navigation.
 if(!items.length)return <p>{zh?'暂无可查看的退款申请。':'No refund requests.'}</p>;
 return <RecordSwitchContext.Provider value={updateLock}><div className={styles.selector}><label>{zh?'选择退款申请':'Select refund request'}<select value={current?.id??''} disabled={locked} onChange={e=>{const next=e.target.value;if(dirty&&!window.confirm(zh?'切换申请将清除尚未提交的输入，是否继续？':'Switching requests clears unsaved input. Continue?'))return;setSelected(next);setDirty(false);window.history.replaceState(null,'',`#refund-${next}`);}}>{items.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></label><span>{zh?`共 ${items.length} 笔`:`${items.length} requests`}</span>{locked&&<p role="status">{zh?'当前操作处理中或结果待核查，核实后再切换申请。':'Resolve the pending operation before switching requests.'}</p>}</div><div key={current?.id} onChange={()=>setDirty(true)}>{current?.actions}{current?.actions?<details><summary>{zh?'查看申请详情':'View request details'}</summary>{current.content}</details>:current?.content}</div></RecordSwitchContext.Provider>;
}
