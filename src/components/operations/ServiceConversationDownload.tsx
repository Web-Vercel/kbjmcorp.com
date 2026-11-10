'use client';
import {useRef,useState} from 'react';
import type {Locale} from '@/lib/content';
export default function ServiceConversationDownload({locale,requestId}:{locale:Locale;requestId:string}){
 const zh=locale==='zh',lock=useRef(false);const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch(`/api/service/${requestId}/export?locale=${locale}`,{cache:'no-store',signal:controller.signal});
   if(!response.ok){setMessage(response.status===401?(zh?'登录已过期，请重新登录后下载。':'Your session expired. Sign in again to download.'):response.status===404?(zh?'当前账号无法访问此工单，请刷新核查权限。':'This request is inaccessible. Refresh and check your access.'):response.status===409?(zh?'工单刚有更新，请刷新后重新下载。':'This request changed. Refresh before downloading again.'):(zh?'暂时无法生成完整记录，请稍后重试。':'A complete copy is unavailable. Try again later.'));return;}
   if(!response.headers.get('content-type')?.startsWith('text/csv'))throw new Error('Unexpected download');
   const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`service-${requestId}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage(zh?'已生成沟通记录，已请求浏览器下载。文件为下载时副本。':'Conversation copy generated; browser download requested. This copy reflects the download time.');
  }catch{setMessage(zh?'下载未完成，请重试；不会发送回复或改变工单。':'Download did not complete. Retry; no reply was sent and the request was not changed.');}
  finally{clearTimeout(timer);lock.current=false;setBusy(false);}
 }
 return <div><button type="button" className="button" disabled={busy} onClick={download}>{busy?(zh?'正在生成记录…':'Generating copy…'):(zh?'下载本工单沟通记录（CSV）':'Download this conversation (CSV)')}</button><p role="status" aria-live="polite">{message}</p></div>;
}
