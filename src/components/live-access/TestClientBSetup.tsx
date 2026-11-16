'use client';
import {useRef,useState} from 'react';
import {z} from 'zod';
import PasswordInput from '@/components/auth/PasswordInput';
type Props={locale:'zh'|'en';organization:{id:string;name:string};email:string;existing:boolean;active:boolean};
export default function TestClientBSetup({locale,organization,email,existing,active}:Props){
 const zh=locale==='zh',lock=useRef(false);const [busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[password,setPassword]=useState(''),[message,setMessage]=useState('');
 async function setup(){
  if(lock.current||attempted||existing)return;lock.current=true;setBusy(true);setAttempted(true);
  let created=false;
  try{
   const bytes=crypto.getRandomValues(new Uint8Array(24));const secret='T!1a'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');setPassword(secret);
   const post=async(path:string,body:unknown)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify(body)});return {response:r,data:await r.json()};};
   const base={email,label:'客户乙（隔离测试）',role:'client',organizationId:organization.id,note:'所有者授权：使用本人邮箱别名，为既有测试企业B创建隔离测试账号。仅限虚构企业测试，不产生收付款。',confirm:'on'};
   const result=await post('/api/admin/live-account-create',{...base,password:secret});const d=result.data;
   if(!result.response.ok||d.ok!==true||!z.uuid().safeParse(d.userId).success||d.organizationId!==organization.id||d.role!=='client'||d.active!==false||!z.number().int().positive().safeParse(d.revision).success){
    setMessage(zh?'创建结果需要核查。请刷新查看账号列表；不要重复创建。如账号已存在，请使用现有账号。':'Creation needs verification. Refresh the account list before any retry. Use the existing account if present.');return;
   }
   created=true;
   const activation=await post('/api/admin/live-access',{...base,userId:d.userId,active:'yes',revision:String(d.revision),note:'所有者授权启用客户乙，仅关联测试企业B，用于客户间隔离验收；无财务操作。'});
   if(!activation.response.ok||activation.data.ok!==true||!Number.isInteger(activation.data.revision)||activation.data.revision<=d.revision){setMessage(zh?'客户乙账号已创建，启用结果待核查。请刷新下方列表确认状态；若仍暂停，可恢复此账号，不要重新创建。':'Client B was created; activation needs verification. Refresh the list and resume it if paused. Do not create it again.');return;}
   setMessage(zh?'客户乙已创建并启用，只关联测试企业B。请先保存初始密码，再使用外部登录门户测试。':'Client B is created and active for Test Company B only. Save the initial password before signing in through the external portal.');
  }catch{setMessage(zh?(created?'账号已创建，启用结果未确认。刷新列表核查，不要重复创建。':'创建结果未确认。刷新列表核查；如列表没有此账号，请先核对 Auth 用户，避免重复创建。'):'Result unconfirmed. Check the account list and Auth users before retrying.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="admin-panel"><h2>{zh?'客户乙 · 隔离测试配置':'Client B · Isolation test setup'}</h2><p>{zh?'仅限 Preview：为虚构测试企业开通真实登录账号。不创建账单、不充值、不发送邮件。':'Preview only: a real sign-in account for the existing fictional company. No bills, deposits or email are created.'}</p><dl className="admin-facts"><dt>{zh?'关联企业':'Company'}</dt><dd>{organization.name}</dd><dt>{zh?'登录邮箱':'Sign-in email'}</dt><dd>{email}</dd><dt>{zh?'角色':'Role'}</dt><dd>{zh?'企业客户 · 仅本企业':'Client · This company only'}</dd></dl>{existing?<p>{zh?`已有客户账号，${active?'使用中':'已暂停'}。请使用此账号；无需重复创建。`:`A client account already exists (${active?'active':'paused'}). Use it without creating another.`}</p>:<><button className="button" type="button" disabled={busy||attempted} onClick={setup}>{busy?(zh?'正在配置…':'Setting up…'):(zh?'创建并启用客户乙（测试）':'Create and activate test Client B')}</button>{password&&<label>{zh?'初始密码（请保存，刷新后不再显示）':'Initial password (save before refreshing)'}<PasswordInput locale={locale} value={password} readOnly autoComplete="off"/></label>}</>}<p role="status">{message}</p>{!existing&&<p>{zh?'此邮箱为当前管理员本人的 Gmail 别名；本操作不改变客户甲及其他账号的权限。':'This email is a Gmail alias of the current administrator. Client A and other account permissions remain unchanged.'}</p>}</section>;
}
