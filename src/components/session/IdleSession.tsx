'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {activityKey,idleRemaining,idleWarningMs,validActivity} from '@/lib/auth/idle';
import {notifySessionChange,reloadForSessionChange} from '@/lib/auth/session-sync';
import styles from './WorkspaceHelp.module.css';

export default function IdleSession({userId,locale,internal}:{userId:string;locale:'zh'|'en';internal:boolean}){
 const zh=locale==='zh',dialog=useRef<HTMLDialogElement>(null),last=useRef(0),busy=useRef(false),expired=useRef(false),warning=useRef(false);
 const [remaining,setRemaining]=useState<number|null>(null),[failed,setFailed]=useState(false);
 const logout=useCallback(async()=>{
  if(busy.current)return;busy.current=true;expired.current=true;setRemaining(0);setFailed(false);
  try{
   // A stale tab must never sign out a newer account in the same browser.
   const identity=await fetch('/api/auth/session-identity',{cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(identity.status===401){notifySessionChange();window.location.replace(`/${locale}/${internal?'admin':'access'}/login?reason=idle`);return;}
   if(!identity.ok)throw Error('identity unavailable');const data=await identity.json();
   if(data.userId!==userId){reloadForSessionChange();return;}
   const result=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:userId}),signal:AbortSignal.timeout(8000)});
   if(result.status===409){reloadForSessionChange();return;}
   if(!result.ok)throw Error('logout unconfirmed');notifySessionChange();window.location.replace(`/${locale}/${internal?'admin':'access'}/login?reason=idle`);
  }catch{setFailed(true);}finally{busy.current=false;}
 },[userId,locale,internal]);
 useEffect(()=>{
  const key=activityKey(userId),now=Date.now();let disposed=false;
  const read=()=>{try{const time=validActivity(localStorage.getItem(key),Date.now());if(time!==null)last.current=Math.max(last.current,time);}catch{/* Memory fallback if storage is unavailable. */}};
  const write=(time:number)=>{last.current=time;try{localStorage.setItem(key,String(time));}catch{/* This tab still enforces inactivity. */}};
  last.current=0;read();if(!last.current)write(now);
  const tick=()=>{if(disposed||expired.current)return;read();const left=idleRemaining(last.current,Date.now());if(!left){void logout();return;}warning.current=left<=idleWarningMs;setRemaining(warning.current?Math.ceil(left/1000):null);};
  const activity=(event:Event)=>{if(!event.isTrusted||expired.current)return;read();if(!idleRemaining(last.current,Date.now())){void logout();return;}if(warning.current)return;if(Date.now()-last.current>=1000)write(Date.now());};
  const events=['pointerdown','pointermove','keydown','wheel','touchstart'];for(const event of events)window.addEventListener(event,activity,{passive:true});
  const storage=(event:StorageEvent)=>{if(event.key===key)tick();};const visible=()=>{if(document.visibilityState==='visible')tick();};
  window.addEventListener('storage',storage);window.addEventListener('focus',tick);window.addEventListener('pageshow',tick);document.addEventListener('visibilitychange',visible);
  tick();const timer=setInterval(tick,1000);
  return()=>{disposed=true;clearInterval(timer);for(const event of events)window.removeEventListener(event,activity);window.removeEventListener('storage',storage);window.removeEventListener('focus',tick);window.removeEventListener('pageshow',tick);document.removeEventListener('visibilitychange',visible);};
 },[userId,logout]);
 useEffect(()=>{const el=dialog.current;if(!el)return;if(remaining!==null&&!el.open)el.showModal();else if(remaining===null&&el.open)el.close();},[remaining]);
 function resume(){if(expired.current||!idleRemaining(last.current,Date.now())){void logout();return;}const now=Date.now();last.current=now;try{localStorage.setItem(activityKey(userId),String(now));}catch{}warning.current=false;setRemaining(null);}
 return <dialog ref={dialog} className={styles.idle} onCancel={event=>event.preventDefault()} aria-labelledby="idle-title"><h2 id="idle-title">{zh?'登录闲置提醒':'Inactivity reminder'}</h2>{remaining!==null&&remaining>0?<><p>{zh?`已接近 15 分钟无操作，${remaining} 秒后将自动退出。未提交的内容不会自动保存。`:`You are approaching 15 minutes of inactivity. Sign-out in ${remaining} seconds. Unsubmitted changes are not saved automatically.`}</p><button className="button" onClick={resume}>{zh?'继续使用':'Continue working'}</button></>:<><p role="status">{failed?(zh?'退出尚未确认。当前页面已锁定，请重试退出；未提交内容未保存。':'Sign-out is unconfirmed. This page is locked. Retry sign-out; unsubmitted changes were not saved.'):(zh?'正在退出闲置账户…':'Signing out the inactive account…')}</p>{failed&&<button className="button" onClick={()=>void logout()}>{zh?'重试退出':'Retry sign-out'}</button>}</>}</dialog>;
}
