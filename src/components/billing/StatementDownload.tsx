'use client';
import {useState} from 'react';
import {statementCsv,statementHtml} from '@/lib/billing/statement-export';
import type {ClientStatement} from '@/lib/billing/client-statement';
export default function StatementDownload({statement,zh}:{statement:ClientStatement;zh:boolean}){
 const [failed,setFailed]=useState(false);
 function download(format:'csv'|'html'){
  setFailed(false);let url:string|undefined;let link:HTMLAnchorElement|undefined;
  try{const content=format==='csv'?statementCsv(statement,zh):statementHtml(statement,zh);url=URL.createObjectURL(new Blob([content],{type:format==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8'}));link=document.createElement('a');link.href=url;link.download=`monthly-statement-${statement.month.slice(0,7)}-${statement.id}.${format}`;document.body.append(link);link.click();}
  catch{setFailed(true);}finally{link?.remove();if(url){const saved=url;setTimeout(()=>URL.revokeObjectURL(saved),1000);}}
 }
 return <div style={{marginBlock:'1.5rem'}}><button className="button" type="button" onClick={()=>download('csv')}>{zh?'下载本账单（CSV）':'Download statement (CSV)'}</button>{' '}<button className="button" type="button" onClick={()=>download('html')}>{zh?'下载阅读版账单（可打印 PDF）':'Download readable statement (print to PDF)'}</button><p>{zh?'CSV 可用 Excel 打开。阅读版下载后用浏览器打开，可打印或另存为 PDF；文件保留本账单编号与已扣金额。':'Open CSV in Excel. Open the readable file in a browser to print or save as PDF; it retains the statement ID and posted charge.'}</p>{failed&&<p role="alert">{zh?'下载未完成，请刷新账单后重试。':'Download failed. Refresh the statement and retry.'}</p>}</div>;
}
