'use client';
import {useState} from 'react';
export default function DemoExitButton({locale}:{locale:'zh'|'en'}){
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);async function exit(){setBusy(true);setFailed(false);try{const response=await fetch('/api/demo/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error();location.assign(`/${locale}`);}catch{setFailed(true);setBusy(false);}}
 return <div><button className="button" type="button" disabled={busy} onClick={exit}>{locale==='zh'?'退出演示，返回网站':'Exit demo and return to website'}</button>{failed&&<p role="alert">{locale==='zh'?'退出未完成，请重试。':'Sign-out incomplete. Try again.'}</p>}</div>;
}
