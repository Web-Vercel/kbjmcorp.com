'use client';
import {useEffect,useState,type ReactNode} from 'react';
import RecordPicker from '@/components/workspace/RecordPicker';
export default function AdsSourceVersionGroup({locale,current,history,latestPending}:{locale:'zh'|'en';current:ReactNode;history:{id:string;label:string;content:ReactNode}[];latestPending:boolean}){
 const zh=locale==='zh';const [open,setOpen]=useState(false);
 useEffect(()=>{const reveal=()=>{let hash='';try{hash=decodeURIComponent(window.location.hash.slice(1));}catch{return;}if(history.some(item=>'ad-source-'+item.id===hash))setOpen(true);};reveal();window.addEventListener('hashchange',reveal);return()=>window.removeEventListener('hashchange',reveal);},[history]);
 return <>{latestPending&&<p className="admin-error">{zh?'有更新的读取尚未通过核对，已保留在读取历史中。下方展示最近已核对版本，不代表更新的数据已通过。':'A newer read is unreconciled and retained in read history. The view below uses the latest reconciled version, not approval of newer data.'}</p>}{current}{history.length>0&&<details open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>{zh?`读取历史（另有 ${history.length} 个版本）`:`Read history (${history.length} other versions)`}</summary><p>{zh?'同一期间的不同读取版本，不能相加；已引用的旧版本保持不变。':'Repeated reads of the same period must not be added. Referenced older versions remain unchanged.'}</p><RecordPicker locale={locale} label={zh?'选择历史读取版本':'Select historical read'} hashPrefix="ad-source-" items={history}/></details>}</>;
}
