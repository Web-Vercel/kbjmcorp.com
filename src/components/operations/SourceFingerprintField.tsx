'use client';
import {useEffect,useRef,useState} from 'react';
import type {Locale} from '@/lib/content';
export const MAX_SOURCE_BYTES=25*1024*1024;
export async function pdfFingerprint(file:File):Promise<string>{
 if(file.size===0||file.size>MAX_SOURCE_BYTES)throw new Error('size');
 const bytes=await file.arrayBuffer();
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('pdf');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export default function SourceFingerprintField({locale,required=false,allowCsv=false}:{locale:Locale;required?:boolean;allowCsv?:boolean}){
 const zh=locale==='zh';const hash=useRef<HTMLInputElement>(null);const file=useRef<HTMLInputElement>(null);const generation=useRef(0);const [message,setMessage]=useState('');
 useEffect(()=>{const form=hash.current?.form;const reset=()=>{generation.current++;hash.current?.setCustomValidity('');setMessage('');};form?.addEventListener('reset',reset);return()=>{generation.current++;form?.removeEventListener('reset',reset);};},[]);
 async function select(){const token=++generation.current;const chosen=file.current?.files?.[0];if(hash.current){hash.current.value='';hash.current.setCustomValidity('');}setMessage('');if(!chosen)return;
 hash.current?.setCustomValidity(zh?'请等待文件指纹计算完成。':'Wait for the file fingerprint.');setMessage(zh?'正在本机计算…':'Computing locally…');
 try{let result:string;if(allowCsv&&chosen.name.toLowerCase().endsWith('.csv')){if(!chosen.size||chosen.size>MAX_SOURCE_BYTES)throw new Error('size');const digest=await crypto.subtle.digest('SHA-256',await chosen.arrayBuffer());result=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}else result=await pdfFingerprint(chosen);if(token!==generation.current)return;if(hash.current){hash.current.value=result;hash.current.setCustomValidity('');}setMessage(zh?'文件指纹已生成。未上传文件；请另行核对账户、月份、币种和金额。':'Fingerprint generated. File not uploaded; check account, month, currency and amount separately.');}
 catch{if(token!==generation.current)return;hash.current?.setCustomValidity(zh?'请选择有效 PDF 或清除文件选择。':'Select a valid PDF or clear the selection.');setMessage(allowCsv?(zh?'无法计算：请选择不超过25MB的 PDF 或 CSV，或清除选择后登记文件指纹。':'Could not compute. Select a PDF or CSV up to 25MB, or clear it and register its fingerprint.'):(zh?'无法计算：请选择不超过25MB的 PDF，或清除选择后手动登记指纹。':'Could not compute. Select a PDF up to 25MB, or clear it and register a fingerprint manually.'));}}
 function clear(){generation.current++;if(file.current)file.current.value='';if(hash.current){hash.current.value='';hash.current.setCustomValidity('');}setMessage('');}
 return <fieldset style={{marginTop:24,marginBottom:24}}><legend>{allowCsv?(zh?'平台核实文件指纹（PDF 或 CSV）':'Platform evidence fingerprint (PDF or CSV)'):(required?(zh?'原始 PDF 文件指纹（必填）':'Original PDF fingerprint (required)'):(zh?'原始 PDF 文件指纹（选填）':'Original PDF fingerprint (optional)'))}</legend><p>{zh?'用于核对交接文件是否一致，不证明来源真实或金额正确。文件仅在本机读取，不上传、不保存文件内容。':'Compare handoff files; this does not verify authenticity or amounts. File contents stay on this device and are not uploaded or stored.'}</p><label>{allowCsv?(zh?'选择核实文件（最大25MB）':'Select evidence file (up to 25MB)'):(zh?'选择原始 PDF（最大25MB）':'Select original PDF (up to 25MB)')}<input ref={file} type="file" accept={allowCsv?'.csv,.pdf':'application/pdf,.pdf'} onChange={select}/></label><button className="button" type="button" onClick={clear}>{zh?'清除文件与指纹':'Clear file and fingerprint'}</button><label>{required?(zh?'原件 SHA-256（必填）':'Evidence SHA-256 (required)'):(zh?'原件SHA-256（选填，仅登记）':'Source SHA-256 (optional; recorded only)')}<input ref={hash} name="hash" required={required} pattern="[a-f0-9]{64}" maxLength={64} onChange={()=>{generation.current++;if(file.current)file.current.value='';hash.current?.setCustomValidity('');setMessage('');}}/></label><p role="status" aria-live="polite">{message}</p></fieldset>;
}
