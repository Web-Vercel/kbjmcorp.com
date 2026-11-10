'use client';
import {useCallback,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {clientReturnTo} from '@/lib/auth/client-return';
import type {Locale} from '@/lib/content';
import Captcha from '@/components/Captcha';
export default function ClientTestLogin({locale,siteKey,returnTo}:{locale:Locale;siteKey:string;returnTo?:string|null}){
 const zh=locale==='zh';const router=useRouter();const lock=useRef(false);const [token,setToken]=useState('');const [version,setVersion]=useState(0);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const onToken=useCallback((value:string)=>setToken(value),[]);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;if(!token){setMessage(zh?'请完成安全验证。':'Complete security verification.');return;}
 const form=event.currentTarget;const data=new FormData(form);lock.current=true;setBusy(true);setMessage('');
 try{const response=await fetch('/api/auth/test-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password'),captchaToken:token})});
 if(response.ok){form.reset();router.replace(clientReturnTo(returnTo,locale)||`/${locale}/account`);router.refresh();return;}
 setMessage(response.status===429?(zh?'尝试过于频繁，请稍后重试。':'Too many attempts. Try again later.'):response.status===404?(zh?'此测试入口未开放。':'This test entry is not enabled.'):(zh?'登录未完成，请核对测试账号及公司授权。':'Sign-in failed. Check the test credentials and company authorization.'));
 }catch{setMessage(zh?'暂时无法连接，请稍后重试。':'Connection unavailable. Try again later.');}
 finally{lock.current=false;setBusy(false);setToken('');setVersion(value=>value+1);const password=form.elements.namedItem('password');if(password instanceof HTMLInputElement)password.value='';}}
 return <form className="admin-form" onSubmit={submit} aria-busy={busy}><label>{zh?'测试客户邮箱':'Test client email'}<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>{zh?'密码':'Password'}<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label><Captcha key={version} locale={locale} siteKey={siteKey} onToken={onToken}/><button className="button" disabled={busy}>{busy?(zh?'正在登录…':'Signing in…'):(zh?'登录测试客户中心':'Sign in to test client center')}</button><p role="status" aria-live="polite">{message}</p></form>;
}
