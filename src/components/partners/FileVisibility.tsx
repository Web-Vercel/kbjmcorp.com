'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function FileVisibility({fileId,hidden}:{fileId:string;hidden:boolean}){
 const router=useRouter(),lock=useRef(false),request=useRef<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;const form=e.currentTarget,reason=hidden?'restore':String(new FormData(form).get('reason'));request.current??=crypto.randomUUID();lock.current=true;setBusy(true);setMessage('');
 try{const r=await fetch('/api/partner-files',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:request.current,fileId,hidden:!hidden,reason})});if(!r.ok){setMessage('操作结果未确认，请刷新核对文件状态后再操作。');return;}request.current=null;form.reset();setMessage(hidden?'文件已恢复。':'已从当前列表移除，原文件保留在历史文件中。');router.refresh();}catch{setMessage('操作结果未确认，请刷新核对文件状态后再操作。');}finally{lock.current=false;setBusy(false);}}
 return <details><summary>{hidden?'恢复文件':'移除文件'}</summary><form onSubmit={submit}>{!hidden&&<label>移除原因<select name="reason" required onChange={()=>{request.current=null;}}><option value="mistake">误传或重复</option><option value="replaced">已由新版替换</option></select></label>}<p>原文件及操作记录保留，可从历史文件恢复。</p><label><input type="checkbox" required/>确认{hidden?'恢复到当前列表':'从当前列表移除'}</label><button className="button" disabled={busy}>{busy?'处理中…':hidden?'确认恢复':'确认移除'}</button><p role="status">{message}</p></form></details>;
}
