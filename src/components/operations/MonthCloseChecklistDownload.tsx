'use client';
import {useState} from 'react';
import {monthCloseChecklistCsv,type MonthCloseChecklist} from '@/lib/operations/month-close-checklist';
export default function MonthCloseChecklistDownload({report,locale}:{report:MonthCloseChecklist|null;locale:'zh'|'en'}){
 const zh=locale==='zh',[failed,setFailed]=useState(false);
 function download(){if(!report)return;setFailed(false);let url:string|undefined,link:HTMLAnchorElement|undefined;
 try{url=URL.createObjectURL(new Blob([monthCloseChecklistCsv(report,zh)],{type:'text/csv;charset=utf-8'}));link=document.createElement('a');link.href=url;link.download=`internal-month-close-${report.month.slice(0,7)}-${report.organization_id}.csv`;document.body.append(link);link.click();}catch{setFailed(true);}finally{link?.remove();if(url){const saved=url;setTimeout(()=>URL.revokeObjectURL(saved),1000);}}}
 return <section className="admin-panel"><h2>{zh?'内部月结办理清单':'Internal month-close checklist'}</h2><p>{zh?'将本页办理状态下载留档，保留待处理事项。供内部财务交接，不是客户账单或结清证明；查询时点余额不是月末余额。':'Download this page’s workflow status, retaining pending items. For internal finance handoff, not a client bill or settlement certificate. Query-time balance is not a month-end balance.'}</p><button className="button" type="button" disabled={!report} onClick={download}>{zh?'下载内部月结办理清单（CSV）':'Download internal month-close checklist (CSV)'}</button>{!report&&<p>{zh?'账户或关联资料尚未完整取得，暂不提供清单下载。请先确认已有关联账户，并刷新核对来源、查阅、问题和公司间核销数据。':'Account or linked data is incomplete, so export is unavailable. Confirm an account binding and refresh source, reading, question and intercompany information.'}</p>}{failed&&<p role="alert">{zh?'下载未完成，请刷新后重试。':'Download failed. Refresh and retry.'}</p>}</section>;
}
