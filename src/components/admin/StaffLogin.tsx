"use client";
import { useCallback,useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
import Captcha from "@/components/Captcha";
export default function StaffLogin({locale,enabled,siteKey,access=false}:{locale:Locale;enabled:boolean;siteKey:string;access?:boolean}){
 const zh=locale==="zh";const router=useRouter();const [token,setToken]=useState("");const [version,setVersion]=useState(0);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const lock=useRef(false);const onToken=useCallback((value:string)=>setToken(value),[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;if(!enabled){setMessage(zh?"账号登录暂不可用，请联系管理员。":"Staff authentication is not configured.");return;}if(!token){setMessage(zh?"请完成安全验证。":"Complete security verification.");return;}const data=new FormData(event.currentTarget);lock.current=true;setBusy(true);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 const response=await fetch(access?"/api/access/login":"/api/admin/login",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password"),captchaToken:token})});
 if(response.ok){router.replace(access?`/${locale}/access/security`:`/${locale}/admin/security`);router.refresh();}else setMessage(zh?"登录未完成，请核对账号或稍后重试。":"Sign-in failed. Check your account or try later.");
 }catch{setMessage(zh?"连接失败，请稍后重试。":"Connection failed. Try later.");}finally{clearTimeout(timer);lock.current=false;setBusy(false);setToken("");setVersion(v=>v+1);}}
 return <form className="admin-form" onSubmit={submit}><label>{zh?"工作邮箱":"Work email"}<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>{zh?"密码":"Password"}<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>{enabled&&<Captcha key={version} locale={locale} siteKey={siteKey} onToken={onToken}/>}<button className="button" disabled={busy} type="submit">{busy?(zh?"正在登录…":"Signing in…"):(zh?(access?"账户登录":"管理员登录"):(access?"Account sign-in":"Staff sign-in"))}</button><p role="status">{message}</p><small>{zh?"仅限已开通权限的账号，登录后需完成验证器二次验证。":"For provisioned accounts. Authenticator verification is required after sign-in."}</small>{!enabled&&<p className="admin-notice">{zh?"登录服务尚未配置，请联系管理员。":"Sign-in is not configured. Contact an administrator."}</p>}</form>;
}
