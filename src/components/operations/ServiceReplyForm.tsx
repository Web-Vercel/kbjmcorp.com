'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {clientLoginDestination} from '@/lib/auth/client-return';
import {serviceReplyReceipt,type ServiceReplyReceipt} from '@/lib/operations/service-reply';
import {opsStatus} from '@/lib/operations/model';
import {formatDate} from '@/lib/admin/content';
export default function ServiceReplyForm({locale,requestId,staff=false,returnTo,currentStatus="open"}:{locale:'zh'|'en';requestId:string;staff?:boolean;returnTo?:string;currentStatus?:string}){
 const zh=locale==='zh',router=useRouter(),lock=useRef(false),attempt=useRef<{key:string;content:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[unknown,setUnknown]=useState(false),[receipt,setReceipt]=useState<ServiceReplyReceipt|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||receipt)return;const data=new FormData(event.currentTarget),body=String(data.get('body')||'').trim(),status=staff?String(data.get('status')||'in_progress'):'in_progress';
  if(body.length<3||body.length>1500){setMessage(zh?'回复请填写3至1500个字符。':'Enter a reply of 3–1500 characters.');return;}
  const content=JSON.stringify({body,status});if(!attempt.current||attempt.current.content!==content)attempt.current={key:crypto.randomUUID(),content};
  lock.current=true;setBusy(true);setMessage('');setUnknown(false);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch('/api/service',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reply',requestId,replyKey:attempt.current.key,body,status})});
   if(response.status===401){router.push(staff?`/${locale}/admin/login`:clientLoginDestination(locale,returnTo));return;}
   const result=await response.json(),saved=serviceReplyReceipt.safeParse(result.receipt);
   if(response.ok&&result.ok===true&&saved.success&&saved.data.request_id===requestId){setReceipt(saved.data);router.refresh();return;}
   const errors:Record<string,[string,string]>={reply_update_required:staff?['回复功能暂不可用，请保留原内容并联系管理员。','Replies are temporarily unavailable. Retain your text and contact an administrator.']:['回复功能暂不可用，请保留原内容并联系业务人员。','Replies are temporarily unavailable. Retain your text and contact your representative.'],forbidden:['当前账号无权回复此工单，请核查企业、财务权限或员工二次验证。','This account cannot reply. Check company access, finance permission or staff two-factor verification.'],reply_limit:['本工单已达消息上限，请核查已有回复并联系业务人员。','This request has reached its message limit. Check existing replies and contact your representative.'],reply_conflict:['请求编号或内容与原回复冲突，请先核查原记录，不要重复新发。','The request key or content conflicts with an earlier reply. Check the original before sending another.'],invalid_input:['请核对回复内容及处理状态。','Check the reply and status.']};
   if(!response.ok&&errors[result.error])setMessage(errors[result.error][zh?0:1]);else setUnknown(true);
  }catch{setUnknown(true);}finally{clearTimeout(timer);lock.current=false;setBusy(false);}
 }
 if(receipt)return <div role="status"><p>{receipt.replayed?(zh?'已核对到原回复，未重复发送。':'Original reply confirmed; no duplicate sent.'):(zh?'回复已保存。':'Reply saved.')} {zh?'消息编号：':'Message ID: '}<span style={{overflowWrap:'anywhere'}}>{receipt.message_id}</span></p><p>{zh?'保存时间：':'Saved at: '}{formatDate(receipt.created_at,locale)} · {zh?'保存时工单状态：':'Status when saved: '}{opsStatus(receipt.status,locale)}</p><p>{zh?'当前状态以刷新后的工单为准；此回执不改变账单、余额或客户查阅确认。':'Use the refreshed request for its current status. This receipt does not change statements, balances or reading acknowledgements.'}</p><a className="service-link" href={`#service-message-${receipt.message_id}`}>{zh?'定位此条回复':'Locate this reply'}</a><p><button type="button" className="button" onClick={()=>{attempt.current=null;setReceipt(null);setMessage('');}}>{zh?'继续填写下一条回复':'Write another reply'}</button></p></div>;
 return <div><form className="admin-form" onSubmit={submit} aria-busy={busy}><label>{zh?'回复内容':'Reply'}<textarea name="body" required minLength={3} maxLength={1500} rows={4} disabled={busy}/></label>{staff&&<label>{zh?'处理状态':'Status'}<select name="status" defaultValue={["open","in_progress","resolved"].includes(currentStatus)?currentStatus:"open"} disabled={busy}>{['open','in_progress','resolved'].map(s=><option key={s} value={s}>{opsStatus(s,locale)}</option>)}</select></label>}<button className="button" disabled={busy} type="submit">{busy?(zh?'正在发送…':'Sending…'):(zh?'发送回复':'Send reply')}</button><p role="status" aria-live="polite">{message}</p></form>{unknown&&<div role="alert"><p>{zh?'回复结果未知，请先刷新核查原消息；保留原内容重试会使用同一请求编号。不要把未知结果当作未发送。':'Reply result unknown. Refresh and check the original messages; an unchanged retry uses the same request key. Do not assume it was not sent.'}</p><button className="button" type="button" onClick={()=>router.refresh()} disabled={busy}>{zh?'刷新核查原消息':'Refresh and check messages'}</button></div>}</div>;
}
