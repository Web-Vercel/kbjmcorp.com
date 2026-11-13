'use client';
import {useState} from 'react';
import {monthlyFundsCsv,type MonthlyFunds} from '@/lib/billing/monthly-funds';
export default function FundsDownload({report,zh}:{report:MonthlyFunds;zh:boolean}){
 const [failed,setFailed]=useState(false);
 function download(){setFailed(false);let url:string|undefined;let link:HTMLAnchorElement|undefined;
 try{url=URL.createObjectURL(new Blob([monthlyFundsCsv(report,zh)],{type:'text/csv;charset=utf-8'}));link=document.createElement('a');link.href=url;link.download=`funds-${report.month.slice(0,7)}-${report.wallet_id}.csv`;document.body.append(link);link.click();}catch{setFailed(true);}finally{link?.remove();if(url){const saved=url;setTimeout(()=>URL.revokeObjectURL(saved),1000);}}}
 return <div>{report.complete?<button type="button" className="button" onClick={download}>{zh?'下载本月资金对账单（CSV）':'Download monthly funds (CSV)'}</button>:<p className="admin-notice">{zh?'本月超过1000条流水，汇总仍按全部记录计算；为避免下载不完整对账单，已暂停导出，请联系财务取得完整明细。':'This month exceeds 1,000 entries. Totals include all entries; export is disabled to avoid an incomplete file. Contact finance for full details.'}</p>}{failed&&<p role="alert">{zh?'下载未完成，请刷新后重试。':'Download failed. Refresh and retry.'}</p>}</div>;
}
