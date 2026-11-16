'use client';
import {useEffect} from 'react';
import {sessionChannel,reloadForSessionChange} from '@/lib/auth/session-sync';
export default function SessionSync({userId,email}:{userId?:string;email?:string}){
 useEffect(()=>{
  let disposed=false,busy=false,last=-Infinity;let controller:AbortController|undefined;
  const changed=()=>{if(!disposed)reloadForSessionChange();};
  const check=async()=>{
   if(!userId||busy||Date.now()-last<500)return;busy=true;last=Date.now();controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),8000);
   try{const r=await fetch('/api/auth/session-identity',{cache:'no-store',credentials:'same-origin',signal:controller.signal});if(disposed)return;
    if(r.status===401||r.status===403){changed();return;}
    if(!r.ok)return;const current=await r.json();if(disposed)return;
    if(typeof current.userId==='string'&&(current.userId!==userId||(current.email||'').toLowerCase()!==(email||'').toLowerCase()))changed();
   }catch{/* An unavailable identity check is not proof that a different account is signed in. */}
   finally{clearTimeout(timer);busy=false;}
  };
  const storage=(event:StorageEvent)=>{if(event.key===sessionChannel)changed();};
  const visible=()=>{if(document.visibilityState==='visible')void check();};
  const restored=(event:PageTransitionEvent)=>{if(event.persisted)void check();};
  let channel:BroadcastChannel|undefined;
  try{if(typeof window.BroadcastChannel!=='undefined'){channel=new window.BroadcastChannel(sessionChannel);channel.onmessage=changed;}}catch{/* Focus and storage handlers remain available. */}
  window.addEventListener('storage',storage);window.addEventListener('focus',check);window.addEventListener('pageshow',restored);document.addEventListener('visibilitychange',visible);
  return()=>{disposed=true;controller?.abort();channel?.close();window.removeEventListener('storage',storage);window.removeEventListener('focus',check);window.removeEventListener('pageshow',restored);document.removeEventListener('visibilitychange',visible);};
 },[userId,email]);
 return null;
}
