"use client";
import { useCallback,useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/content";
import Captcha from "@/components/Captcha";
export default function StaffLogin({locale,enabled,siteKey}:{locale:Locale;enabled:boolean;siteKey:string}){
 const zh=locale==="zh";const router=useRouter();const [token,setToken]=useState("");const [version,setVersion]=useState(0);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const lock=useRef(false);const onToken=useCallback((value:string)=>setToken(value),[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;if(!enabled){setMessage(zh?"管理员登录尚未连接测试服务。":"Staff authentication is not configured.");return;}if(!token){setMessage(zh?"请完成安全验证。":"Complete security verification.");return;}const data=new FormData(event.currentTarget);lock.current=true;setBusy(true);try{
 const response=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:data.get("email"),password:data.get("password"),captchaToken:token})});
 if(response.ok){router.replace(`/${locale}/admin/security`);router.refresh();}else setMessage(zh?"登录未完成，请核对账号或稍后重试。":"Sign-in failed. Check your account or try later.");
 }catch{setMessage(zh?"连接失败，请稍后重试。":"Connection failed. Try later.");}finally{lock.current=false;setBusy(false);setToken("");setVersion(v=>v+1);}}
 return <form className="admin-form" onSubmit={submit}><label>{zh?"工作邮箱":"Work email"}<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>{zh?"密码":"Password"}<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>{enabled&&<Captcha key={version} locale={locale} siteKey={siteKey} onToken={onToken}/>}<button className="button" disabled={busy} type="submit">{busy?(zh?"正在登录…":"Signing in…"):(zh?"管理员登录":"Staff sign-in")}</button><p role="status">{message}</p><small>{zh?"仅限已开通内部权限的账号。登录后需完成验证器二次验证。":"For provisioned staff accounts. Authenticator verification is required after sign-in."}</small>{!enabled&&<p className="admin-notice">{zh?"当前为未配置环境，可先查看模拟后台预览。":"Authentication is not connected. Explore the fictional workspace preview instead."}</p>}</form>;
}
