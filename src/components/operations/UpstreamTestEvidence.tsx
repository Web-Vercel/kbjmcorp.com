'use client';
import {useEffect,useRef,useState} from 'react';
import {upstreamTestNotice,upstreamTestPdf,upstreamTestPrefix} from '@/lib/billing/upstream-test-fixture';
export default function UpstreamTestEvidence({locale}:{locale:'zh'|'en'}){
 const root=useRef<HTMLButtonElement>(null);const [ready,setReady]=useState(false),[error,setError]=useState('');const zh=locale==='zh';
 useEffect(()=>{const form=root.current?.form;const invalidate=(e:Event)=>{const input=e.target as HTMLInputElement;if(input.name==='received'||input.name==='receivedOn'){const hash=form?.elements.namedItem('hash') as HTMLInputElement|null;if(hash)hash.value='';setReady(false);}};form?.addEventListener('input',invalidate);return()=>form?.removeEventListener('input',invalidate);},[]);
 async function prepare(button:HTMLButtonElement){
  const form=button.form;if(!form)return;setError('');
  const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement|HTMLTextAreaElement;
  const date=field('receivedOn').value,amount=field('received').value;
  if(!date||!/^\d{1,8}(\.\d{1,2})?$/.test(amount)||Number(amount)<=0){setError(zh?'请先填写日期和测试金额。':'Enter a date and positive test amount first.');return;}
  try{const reference=field('bankReference').value||upstreamTestPrefix+crypto.randomUUID();const pdf=upstreamTestPdf(reference,date,amount);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pdf))),b=>b.toString(16).padStart(2,'0')).join('');
   field('bankReference').value=reference;field('evidence').value=upstreamTestNotice;field('note').value=upstreamTestNotice;field('hash').value=hash;
   const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=reference+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setReady(true);form.dispatchEvent(new Event('change',{bubbles:true}));
  }catch{setError(zh?'测试文件生成失败，请重试。':'Could not create the test file. Retry.');}
 }
 return <><input type="hidden" name="testMode" value="on"/><input type="hidden" name="hash" required/><button ref={root} className="button" type="button" onClick={e=>prepare(e.currentTarget)}>{zh?'生成测试凭证 PDF':'Create fictional test PDF'}</button><p role="status">{error||(ready?(zh?'测试凭证与指纹已生成。':'Fictional PDF and fingerprint ready.'):(zh?'先填日期和金额，再生成测试凭证。':'Enter date and amount, then create the fictional PDF.'))}</p></>;
}
