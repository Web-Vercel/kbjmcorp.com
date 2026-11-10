'use client';
import {useEffect,useRef,useState} from 'react';
import {clientStatementPath} from '@/lib/operations/client-statement-handoff';
export default function StatementAccessLink({statementId,locale}:{statementId:string;locale:'zh'|'en'}){
 const zh=locale==='zh',path=clientStatementPath(statementId,locale),input=useRef<HTMLInputElement>(null);
 const [url,setUrl]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{setUrl(path?new URL(path,window.location.origin).href:'');setMessage('');},[path]);
 async function copy(){if(!path)return;try{await navigator.clipboard.writeText(new URL(path,window.location.origin).href);setMessage(zh?'链接已复制，尚未发送给客户。':'Link copied; it has not been sent to the client.');}catch{input.current?.focus();input.current?.select();setMessage(zh?'无法自动复制，请复制上方已选中的链接。':'Automatic copy unavailable. Copy the selected link above.');}}
 if(!path)return <p>{zh?'账单编号尚未核实，暂不提供访问链接。':'Statement ID is unverified; an access link is unavailable.'}</p>;
 return <div style={{marginBlock:16,minWidth:0}}><label style={{display:'grid',gap:8}}>{zh?'客户账单访问链接':'Client statement access link'}<input ref={input} value={url||path} readOnly onFocus={e=>e.currentTarget.select()} style={{width:'100%',minWidth:0,boxSizing:'border-box',minHeight:48,padding:'12px 14px',border:'1px solid #dbe5d7',borderRadius:6,background:'#fafbf7',color:'#173d33',fontFamily:'inherit',fontSize:14}}/></label><button className="button" type="button" onClick={copy} style={{marginTop:12}}>{zh?'复制此账单的客户链接':'Copy client link for this statement'}</button><p role="status" aria-live="polite">{message}</p><p>{zh?'请客户先登录，再打开此链接。链接不授予权限；仍须具备该企业的成员关联和财务查看权限。内部员工不能代客户确认已阅。':'Ask the client to sign in, then open this link. It grants no access; company membership and finance read permission are still required. Staff cannot acknowledge reading on the client’s behalf.'}</p></div>;
}
