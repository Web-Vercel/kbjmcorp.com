import {z} from 'zod';
import type {Locale} from '@/lib/content';
/** A navigation hint only. It never establishes company or finance authorization. */
export function clientStatementReturnTo(input:unknown,locale:Locale):string|null{
 if(typeof input!=='string'||input.length>1000||/[\u0000-\u0020\u007f\\]/.test(input))return null;
 const path=input.split(/[?#]/,1)[0];if(path!=='/zh/account/statements'&&path!=='/en/account/statements')return null;
 try{
  const url=new URL(input,'https://client-return.invalid');if(url.origin!=='https://client-return.invalid')return null;
  const keys=[...url.searchParams.keys()];if(keys.some(k=>!['wallet','month','statement'].includes(k))||new Set(keys).size!==keys.length)return null;
  const query=new URLSearchParams();
  for(const key of ['wallet','month','statement']){const value=url.searchParams.get(key);if(value===null||value==='')continue;
   if(key==='month'){if(!z.iso.date().safeParse(value+'-01').success)return null;query.set(key,value);}
   else {if(!z.uuid().safeParse(value).success)return null;query.set(key,value.toLowerCase());}
  }
  const statement=query.get('statement');if(url.hash&&(!statement||url.hash!==`#statement-${url.searchParams.get('statement')}`))return null;
  return `/${locale}/account/statements${query.size?'?'+query:''}${statement?'#statement-'+statement:''}`;
 }catch{return null;}
}
export function clientLoginDestination(locale:Locale,input:unknown){
 const target=clientStatementReturnTo(input,locale);
 return `/${locale}/login${target?'?'+new URLSearchParams({returnTo:target}):''}`;
}
