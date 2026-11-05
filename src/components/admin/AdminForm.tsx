"use client";
import { useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
export default function AdminForm({locale,endpoint,method="POST",children,button}:{locale:Locale;endpoint:string;method?:"POST"|"PATCH";children:React.ReactNode;button:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const lock=useRef(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;const form=event.currentTarget;lock.current=true;setBusy(true);setMessage("");try{
 const response=await fetch(endpoint,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
 if(response.status===401){router.push(`/${locale}/admin/login`);return;}
 const result=await response.json();
 if(!response.ok){setMessage(locale==="zh"?(result.error==="already_linked"?"该外部账户已有关联，请核对客户归属。":result.error==="mfa_required"?"请先完成二次验证。":"操作未完成，请检查输入并重试。"):result.error==="already_linked"?"This external account is already linked.":"The operation failed. Check your input and try again.");return;}
 setMessage(locale==="zh"?"已保存。":"Saved.");form.reset();router.refresh();
 }catch{setMessage(locale==="zh"?"网络暂时不可用，请重试。":"Network unavailable. Try again.");}finally{setBusy(false);lock.current=false;}}
 return <form className="admin-form" onSubmit={submit} aria-busy={busy}>{children}<button className="button" disabled={busy} type="submit">{busy?(locale==="zh"?"正在保存…":"Saving…"):button}</button><p role="status" aria-live="polite">{message}</p></form>;
}
