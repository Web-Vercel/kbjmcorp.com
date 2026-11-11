"use client";
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {z} from 'zod';
import {toMinor,money,type Currency} from '@/lib/billing/model';
const receiptSchema=z.object({ok:z.literal(true),status:z.literal('pending'),noticeId:z.uuid()});
export default function TopupForm({locale,walletId,currency,onDemoRequest}:{locale:'zh'|'en';walletId:string;currency:Currency;onDemoRequest?:(minor:string,reference:string)=>void}){
 const zh=locale==='zh',router=useRouter(),lock=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[unknown,setUnknown]=useState(false),[receipt,setReceipt]=useState<{id:string;minor:string;reference:string}|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current||receipt)return;const form=event.currentTarget,values=Object.fromEntries(new FormData(form));
  let minor:string;const reference=String(values.reference||'').trim();
  try{minor=toMinor(String(values.amount));if(reference.length<3||reference.length>120||values.confirm!=='on')throw new Error('Invalid');}
  catch{setMessage(zh?'请核对金额、付款参考号并勾选确认。':'Check the amount, payment reference and confirmation.');return;}
  lock.current=true;setBusy(true);setMessage('');setUnknown(false);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   if(onDemoRequest){onDemoRequest(minor,reference);form.reset();setMessage(zh?'虚构演示：已登记待核对，不执行付款或增加余额。':'Fictional demo: registered for verification; no payment or balance credit.');return;}
   const response=await fetch('/api/billing/topups',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,reference,walletId})});
   const result=await response.json(),saved=receiptSchema.safeParse(result);
   if(response.ok&&saved.success){setReceipt({id:saved.data.noticeId,minor,reference});router.refresh();return;}
   const errors:Record<string,[string,string]>={duplicate_reference:['此付款参考号已登记。请刷新核查原通知及金额，不要更换参考号重复登记或再次付款。','This payment reference is already registered. Refresh and check the original notice and amount; do not change the reference or pay again.'],forbidden:['当前账号没有登记付款通知的财务权限，请联系业务人员核查。','This account lacks permission to register payment notices. Contact your representative.'],unauthenticated:['登录已过期，请保留原输入，重新登录后先核查付款通知。','Your session expired. Retain your input, sign in again and check payment notices first.'],invalid_input:['请核对金额、付款参考号并勾选确认。','Check the amount, payment reference and confirmation.']};
   if(response.status===429){setMessage(zh?'待核对通知已达上限，请先核查原记录并联系财务，不要重复登记。':'Pending notice limit reached. Check existing records and contact finance before submitting again.');return;}
   if(!response.ok&&response.status<500&&errors[result.error])setMessage(errors[result.error][zh?0:1]);else setUnknown(true);
  }catch{setUnknown(true);}finally{clearTimeout(timer);lock.current=false;setBusy(false);}
 }
 if(receipt)return <div role="status"><p>{zh?'付款通知已保存，等待财务核对。通知编号：':'Payment notice saved, awaiting finance verification. Notice ID: '}<span style={{overflowWrap:'anywhere'}}>{receipt.id}</span></p><p>{money(receipt.minor,currency,locale)} · {receipt.reference}</p><p>{zh?'这不是到账回执，不执行转账。实际到账核实并独立复核后才增加余额；请勿因此再次付款。':'This is not a receipt of funds and does not initiate a transfer. The balance increases only after actual receipt verification and independent review. Do not pay again because of this notice.'}</p><a className="service-link" href={`#topup-${receipt.id}`}>{zh?'定位原付款通知':'Locate payment notice'}</a><p><button type="button" className="button" onClick={()=>router.refresh()}>{zh?'刷新核查通知与余额':'Refresh notices and balance'}</button></p><button type="button" className="button" onClick={()=>{setReceipt(null);setMessage('');setUnknown(false);}}>{zh?'登记另一笔实际付款通知':'Register a different payment notice'}</button></div>;
 return <div><form className="admin-form billing-topup-form" onSubmit={submit} aria-busy={busy}><p className="workflow-byline">{zh?'请先通过业务渠道与财务确认收款方式。此处登记已安排的付款，用于到账核对；不执行在线支付。':'Confirm payment instructions with your finance contact first. Register an arranged payment here for verification; this form does not process online payments.'}</p><label>{zh?`充值金额（${currency}）`:`Top-up amount (${currency})`}<input name="amount" inputMode="decimal" required pattern="[0-9]{1,8}(\.[0-9]{1,2})?" placeholder="0.00" disabled={busy}/></label><label>{zh?'付款参考号':'Payment reference'}<input name="reference" required minLength={3} maxLength={120} disabled={busy}/></label><label className="admin-checkbox"><input type="checkbox" name="confirm" required disabled={busy}/>{zh?'我理解此申请需核实实际到账，不会立即增加余额。':'I understand this request requires receipt verification and does not immediately credit the balance.'}</label><button className="button" disabled={busy}>{busy?(zh?'提交中…':'Submitting…'):(zh?'提交充值核对':'Request top-up verification')}</button><p role="status" aria-live="polite">{message}</p></form>{unknown&&<div role="alert"><p>{zh?'付款通知结果待核查，不能认定未保存。请保留原金额和付款参考号，先刷新查看原通知；不要换参考号重复登记或再次付款。':'Payment notice result is unconfirmed; do not assume it was not saved. Retain the original amount and reference, then refresh and check notices. Do not change the reference or pay again.'}</p><button className="button" type="button" disabled={busy} onClick={()=>router.refresh()}>{zh?'刷新核查原付款通知':'Refresh and check payment notices'}</button><p><a className="service-link" href="#payment-notices">{zh?'查看付款通知记录':'View payment notice records'}</a></p></div>}</div>;
}
