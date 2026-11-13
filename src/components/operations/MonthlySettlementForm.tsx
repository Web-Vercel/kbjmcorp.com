'use client';
import Link from 'next/link';
import {useRef,useState,type FormEvent,type ReactNode} from 'react';
import {z} from 'zod';
export default function MonthlySettlementForm({locale,mode,draftId,company,month,children,button}:{locale:'zh'|'en';mode:'prepare'|'review';draftId?:string;company?:string;month?:string;children:ReactNode;button:string}){
 const zh=locale==='zh',lock=useRef(false);
 const [busy,setBusy]=useState(false),[receipt,setReceipt]=useState<string|null>(null),[message,setMessage]=useState(''),[unknown,setUnknown]=useState(false),[decision,setDecision]=useState('');
 const query=new URLSearchParams({...company?{company}:{},...month?{month}:{}});
 const record=(id?:string)=>`/${locale}/operations/settlements?${query}#${id?'draft-'+id:'settlement-drafts'}`;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||receipt)return;
  const input=Object.fromEntries(new FormData(event.currentTarget).entries());
  lock.current=true;setBusy(true);setMessage('');setUnknown(false);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch('/api/monthly-settlements',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   if(response.status===401){setMessage(zh?'登录已过期，请保留输入，重新登录后核查原记录。':'Session expired. Retain input, sign in and check the original.');return;}
   const result=await response.json();
   const saved=z.discriminatedUnion('action',[z.object({action:z.literal('prepare'),draftId:z.uuid(),snapshotId:z.uuid(),quoteId:z.uuid()}),z.object({action:z.literal('review'),draftId:z.uuid(),decision:z.enum(['approved','rejected'])})]).safeParse(result.receipt);
   if(response.ok&&result?.ok===true&&saved.success&&saved.data.action===mode&&result.draftId===saved.data.draftId&&(saved.data.action==='prepare'?saved.data.snapshotId===input.snapshotId&&saved.data.quoteId===input.quoteId:saved.data.draftId===draftId&&saved.data.decision===input.decision)){
    setDecision(String(input.decision||''));setReceipt(result.draftId);return;
   }
   const errors:Record<string,[string,string]>={
    forbidden:['当前账号无权处理，请核实企业权限及独立复核要求。','This account cannot perform this action. Check company access and independent-review requirements.'],
    mfa_required:['请先完成二次验证，再核查原记录。','Complete two-factor authentication, then check the original record.'],
    conflict:['原记录或提交内容已变化，请先核查已有草稿及复核结果，不要重复新建。','The record or submitted content changed. Check the existing draft and review before creating another.'],
    invalid_input:['请填写来源、报价、说明并勾选确认。','Complete the source, quote, notes and confirmation.'],
    source_not_ready:['来源汇总或活动覆盖尚未核实，请先核对来源。','Source totals or activity coverage remain unverified. Check the source first.'],
    settlement_mismatch:['请核对来源、报价的企业、月份及广告成本是否一致。','Check that source and quote match the company, month and advertising cost.'],
   };
   if(!response.ok&&response.status<500&&errors[result?.error])setMessage(errors[result.error][zh?0:1]);else setUnknown(true);
  }catch{setUnknown(true);}finally{clearTimeout(timer);lock.current=false;setBusy(false);}
 }
 if(receipt)return <div role="status"><p>{mode==='prepare'?(zh?'已确认月度结算草稿记录。当前复核状态请查看原记录。草稿编号：':'Monthly settlement draft record confirmed. Check the original for current review status. Draft ID: '):(zh?'独立复核结果已保存。草稿编号：':'Independent review saved. Draft ID: ')}<span style={{overflowWrap:'anywhere'}}>{receipt}</span></p>{mode==='review'&&['approved','rejected'].includes(decision)&&<p>{zh?'本次复核结果：':'Review decision: '}{decision==='approved'?(zh?'通过':'Approved'):(zh?'退回，需修订后重新制单':'Rejected; revise and prepare again')}</p>}<p>{zh?'本次操作仅保存制单或复核结果；客户账单发布与余额记账由管理员另行办理。':'This action only saves preparation or review. Client publication and ledger posting are separate administrator actions.'}</p><Link className="service-link" href={record(receipt)} target="_blank" rel="noopener noreferrer">{zh?'定位此结算草稿及复核状态':'Locate this draft and review status'}</Link>{mode==='prepare'&&<p><button className="button" type="button" onClick={()=>{setReceipt(null);setMessage('');}}>{zh?'继续填写其他结算草稿':'Prepare another settlement draft'}</button></p>}</div>;
 return <div><form className="admin-form" onSubmit={submit} aria-busy={busy}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:'grid',gap:20}}>{children}</fieldset><button className="button" type="submit" disabled={busy}>{busy?(zh?'正在提交…':'Submitting…'):button}</button><p role="status" aria-live="polite">{message}</p></form>{unknown&&<div role="alert"><p>{zh?'提交结果待核查，不能据此认定操作失败。请在新页查看原草稿及复核记录，保留原输入；原样重试使用现有流程的重复提交保护。':'Submission result is unconfirmed; do not assume failure. Open the original draft and review in a new tab, retaining the original inputs. Unchanged retries use the existing duplicate-submission protection.'}</p><p><Link className="service-link" href={record(draftId)} target="_blank" rel="noopener noreferrer">{zh?'查看本企业本月结算记录':'View this company’s monthly settlements'}</Link></p></div>}</div>;
}
