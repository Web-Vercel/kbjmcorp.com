'use client';
import {sourceCsv,type ExportSource} from '@/lib/ads/source-export';
export default function AdsSourceDownload({source,zh}:{source:ExportSource;zh:boolean}){
 function download(){
 const url=URL.createObjectURL(new Blob([sourceCsv(source,zh)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`ads-source-${source.since}-${source.until}-${source.snapshot_id}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div style={{marginBlock:'1.5rem'}}><button type="button" className="button" onClick={download}>{zh?'下载本版本报告（CSV）':'Download this report (CSV)'}</button><p>{zh?'包含期间汇总、每日明细和核对提示，可用 Excel 打开。下载文件会保留当前数据状态。':'Includes period spend, daily rows and reconciliation notices. Open in Excel. The file retains the current source status.'}</p></div>;
}
