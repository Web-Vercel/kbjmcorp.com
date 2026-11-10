'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {statementReadReceipt} from '@/lib/billing/statement-read';
import {statementPublishedAt} from '@/lib/billing/client-statement';
export default function StatementReadConfirmation({statementId,confirmedAt,available,locale}:{statementId:string;confirmedAt:string|null;available:boolean;locale:'zh'|'en'}){
 const zh=locale==='zh',router=useRouter(),lock=useRef(false);const [at,setAt]=useState(confirmedAt),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current||at||!available)return;const form=e.currentTarget;if(new FormData(form).get('confirm')!=='on')return;lock.current=true;setBusy(true);setMessage('');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{const response=await fetch('/api/client/statement-read',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({statementId,confirm:'on'})});const data=await response.json();const receipt=statementReadReceipt.safeParse(data.receipt);
 if(response.status===401){router.push(`/${locale}/login`);return;}if(!response.ok||data.ok!==true||!receipt.success||receipt.data.statement_id!==statementId){setMessage(zh?'确认结果未取得，请刷新核查当前权限及查阅记录。':'Confirmation unavailable. Refresh and check your access and receipt.');return;}
 setAt(receipt.data.confirmed_at);router.refresh();
 }catch{setMessage(zh?'保存结果未知，请刷新核查；重复确认同一账单不会新增重复记录。':'Save result unknown. Refresh and check; confirming the same statement again does not duplicate the record.');}finally{clearTimeout(timer);setBusy(false);lock.current=false;}}
 return <section style={{marginBlock:24}}><h3>{zh?'客户查阅确认':'Client reading acknowledgement'}</h3>{at?<p role="status">{zh?'您已确认查阅：':'You acknowledged reading: '}{statementPublishedAt(at,zh)}</p>:!available?<p>{zh?'查阅确认记录暂不可用；您仍可查看和下载账单，稍后刷新重试。':'Reading receipts are unavailable. You can still view/download the statement; refresh later.'}</p>:<form onSubmit={submit} aria-busy={busy}><p>{zh?'此操作仅记录您已查阅本账单，费用疑问仍可联系业务人员处理，不会再次扣款。':'This only records that you read the statement. You can still raise billing questions; no additional charge occurs.'}</p><label className="admin-checkbox"><input type="checkbox" name="confirm" required disabled={busy}/>{zh?'我已查看本账单的金额、月份及使用情况。':'I have viewed this statement’s amount, month and usage.'}</label><button type="submit" className="button" disabled={busy}>{busy?(zh?'正在确认…':'Confirming…'):(zh?'确认已阅本账单':'Acknowledge reading this statement')}</button><p role="status" aria-live="polite">{message}</p></form>}</section>;
}
