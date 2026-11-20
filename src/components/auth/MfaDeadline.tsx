'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {notifySessionChange,reloadForSessionChange} from '@/lib/auth/session-sync';
import styles from '@/components/session/WorkspaceHelp.module.css';
export default function MfaDeadline({deadline,serverNow,userId,portal,locale,setup,finished,destination}:{deadline:number;serverNow:number;userId:string;portal:'admin'|'access';locale:'zh'|'en';setup:boolean;finished:boolean;destination:string}){
 const zh=locale==='zh',initial=useRef({deadline,clock:Date.now(),serverNow}),lock=useRef(false),attempted=useRef(false),dialog=useRef<HTMLDialogElement>(null),[left,setLeft]=useState(Math.max(0,Math.ceil((deadline-serverNow)/1000))),[expired,setExpired]=useState(false),[error,setError]=useState(false);
 const expire=useCallback(async()=>{if(lock.current)return;lock.current=true;attempted.current=true;setExpired(true);setError(false);
  try{const r=await fetch('/api/auth/mfa-window',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({portal,expectedUserId:userId}),signal:AbortSignal.timeout(12000)});
   if(r.status===409){reloadForSessionChange();return;}if(r.status===401){window.location.replace(`/${locale}/${portal}/login?reason=mfa_timeout`);return;}if(!r.ok)throw Error();const body=await r.json();
   if(body.complete===true){window.location.replace(destination);return;}
   if(body.expired===true){notifySessionChange();window.location.replace(`/${locale}/${portal}/login?reason=mfa_timeout`);return;}
   if(typeof body.deadline==='number'&&typeof body.serverNow==='number'&&body.deadline>body.serverNow){initial.current={deadline:body.deadline,serverNow:body.serverNow,clock:Date.now()};attempted.current=false;setExpired(false);return;}throw Error();
  }catch{setError(true);}finally{lock.current=false;}
 },[portal,userId,locale,destination]);
 useEffect(()=>{if(finished)return;const tick=()=>{const v=initial.current;const seconds=Math.max(0,Math.ceil((v.deadline-v.serverNow-(Date.now()-v.clock))/1000));setLeft(seconds);if(!seconds&&!attempted.current)void expire();};tick();const timer=setInterval(tick,1000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};},[finished,expire]);
 useEffect(()=>{if(expired&&!dialog.current?.open)dialog.current?.showModal();if(!expired&&dialog.current?.open)dialog.current.close();},[expired]);
 return <><p role="status">{zh?`${setup?'首次绑定限时 10 分钟':'身份验证限时 5 分钟'}，剩余 ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}。到期将退出本次登录。`:`${setup?'Initial setup: 10 minutes':'Verification: 5 minutes'}. Remaining ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}. This sign-in ends when time expires.`}</p><dialog ref={dialog} className={styles.idle} onCancel={e=>e.preventDefault()} aria-labelledby="mfa-timeout-title"><h2 id="mfa-timeout-title">{zh?'验证时间已到':'Verification time expired'}</h2><p>{error?(zh?'退出尚未确认，请重试。验证页面已锁定。':'Sign-out is unconfirmed. Retry; verification is locked.'):(zh?'正在清理本次登录…':'Ending this sign-in…')}</p>{error&&<button className="button" onClick={()=>void expire()}>{zh?'重试退出':'Retry sign-out'}</button>}</dialog></>;
}
