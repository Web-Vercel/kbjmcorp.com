"use client";
import { useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
export default function AdminForm({locale,endpoint,method="POST",children,button,loginMode="staff"}:{locale:Locale;loginMode?:"staff"|"client";endpoint:string;method?:"POST"|"PATCH";children:React.ReactNode;button:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const lock=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;const form=event.currentTarget;lock.current=true;setBusy(true);setMessage("");try{
 const response=await fetch(endpoint,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
 if(response.status===401){router.push(`/${locale}/${loginMode==="staff"?"admin/login":"login"}`);return;}
 const result=await response.json();
 if(!response.ok){
 const settlementErrors:Record<string,[string,string]>={source_not_ready:['来源的日期、每日明细或花费仍未完成核对，暂不能制单。','Source dates, daily coverage or spend still need reconciliation.'],settlement_mismatch:['请核对来源与报价是否属于同一企业、同一完整月份，且报价广告成本与整月来源总额一致。','Check that source and quote match the company, complete month and rounded monthly source spend.']};
 if(settlementErrors[result.error]){setMessage(settlementErrors[result.error][locale==='zh'?0:1]);return;}
 setMessage(locale==="zh"?(result.error==="duplicate_reference"?"流水号已登记，请查看原记录，勿重复入账。":result.error==="conflict"?"记录状态已变化，请刷新并核对原处理结果。":result.error==="already_linked"?"该外部账户已有关联，请核对客户归属。":result.error==="mfa_required"?"请先完成二次验证。":"操作未完成，请检查输入并重试。"):result.error==="duplicate_reference"?"This transaction is already registered. Check the original record.":result.error==="conflict"?"The record changed. Refresh and check the existing result.":result.error==="already_linked"?"This external account is already linked.":"The operation failed. Check your input and try again.");return;}
 setMessage(locale==="zh"?"已保存。":"Saved.");form.reset();router.refresh();
 }catch{setMessage(locale==="zh"?"网络暂时不可用，请重试。":"Network unavailable. Try again.");}finally{setBusy(false);lock.current=false;}}
 return <form className="admin-form" onSubmit={submit} aria-busy={busy}>{children}<button className="button" disabled={busy} type="submit">{busy?(locale==="zh"?"正在保存…":"Saving…"):button}</button><p role="status" aria-live="polite">{message}</p></form>;
}
