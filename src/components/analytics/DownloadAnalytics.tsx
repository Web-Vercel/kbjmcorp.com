'use client';
import {useRef,useState} from 'react';
import styles from './AnalyticsDashboard.module.css';
export default function DownloadAnalytics({href,label,locale}:{href:string;label:string;locale:'zh'|'en'}){
 const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');const c=new AbortController(),timer=setTimeout(()=>c.abort(),30000);try{const r=await fetch(href,{signal:c.signal,cache:'no-store'});if(!r.ok||!r.headers.get('content-type')?.startsWith('text/csv'))throw Error();const blob=await r.blob();if(blob.size>16777216)throw Error();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=r.headers.get('content-disposition')?.match(/filename="([a-zA-Z0-9.-]+)"/)?.[1]||'analytics.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setMessage(locale==='zh'?'下载未完成，请核对登录状态和权限后重试；页面筛选已保留。':'Download failed. Check sign-in and access, then retry. Your filters are preserved.');}finally{clearTimeout(timer);lock.current=false;setBusy(false);}}
 return <span><button type="button" className={styles.clear} disabled={busy} onClick={download}>{busy?(locale==='zh'?'正在准备…':'Preparing…'):label}</button>{message&&<span role="alert">{message}</span>}</span>;
}
