import {z} from 'zod';
import type {Locale} from '@/lib/content';
/** A navigation hint only. It never establishes company or finance authorization. */
function scopedClientReturn(input:unknown,locale:Locale,kind:'statements'|'service'):string|null{
 if(typeof input!=='string'||input.length>1000||/[\u0000-\u0020\u007f\\]/.test(input))return null;
 const route=kind==='statements'?'account/statements':'account/service';
 const path=input.split(/[?#]/,1)[0];if(path!==`/zh/${route}`&&path!==`/en/${route}`)return null;
 try{
  const url=new URL(input,'https://client-return.invalid');if(url.origin!=='https://client-return.invalid')return null;
  const allowed=kind==='statements'?['wallet','month','statement']:['ticket','statement'];
  const keys=[...url.searchParams.keys()];if(keys.some(k=>!allowed.includes(k))||new Set(keys).size!==keys.length)return null;
  const query=new URLSearchParams();
  for(const key of allowed){const value=url.searchParams.get(key);if(value===null||value==='')continue;
   if(key==='month'){if(!z.iso.date().safeParse(value+'-01').success)return null;query.set(key,value);}
   else {if(!z.uuid().safeParse(value).success)return null;query.set(key,value.toLowerCase());}
  }
  const anchorKey=kind==='statements'?'statement':'ticket',id=query.get(anchorKey),prefix=kind==='statements'?'statement':'service-request';
  if(url.hash&&(!id||url.hash!==`#${prefix}-${url.searchParams.get(anchorKey)}`))return null;
  return `/${locale}/${route}${query.size?'?'+query:''}${id?'#'+prefix+'-'+id:''}`;
 }catch{return null;}
}
export function clientStatementReturnTo(input:unknown,locale:Locale){return scopedClientReturn(input,locale,'statements');}
export function clientReturnTo(input:unknown,locale:Locale){return clientStatementReturnTo(input,locale)||scopedClientReturn(input,locale,'service');}
export function clientLoginDestination(locale:Locale,input:unknown){
 const target=clientReturnTo(input,locale);
 return `/${locale}/login${target?'?'+new URLSearchParams({returnTo:target}):''}`;
}
