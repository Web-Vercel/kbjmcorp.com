'use client';
import {useState} from 'react';
export default function DemoExitButton({locale,returnToLogin=false}:{returnToLogin?:boolean;locale:'zh'|'en'}){
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);async function exit(){setBusy(true);setFailed(false);try{const response=await fetch('/api/demo/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error();location.assign(returnToLogin?`/${locale}/access/login`:`/${locale}`);}catch{setFailed(true);setBusy(false);}}
 return <div><button className="button" type="button" disabled={busy} onClick={exit}>{returnToLogin?(locale==='zh'?'清除旧演示会话，继续登录':'Clear old demo session and continue'):(locale==='zh'?'退出演示，返回网站':'Exit demo and return to website')}</button>{failed&&<p role="alert">{locale==='zh'?'退出未完成，请重试。':'Sign-out incomplete. Try again.'}</p>}</div>;
}
