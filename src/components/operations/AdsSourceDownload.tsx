'use client';
import {sourceCsv,sourceHtml,type ExportSource} from '@/lib/ads/source-export';
export default function AdsSourceDownload({source,zh}:{source:ExportSource;zh:boolean}){
 function download(format:'csv'|'html'){
 const url=URL.createObjectURL(new Blob([format==='csv'?sourceCsv(source,zh):sourceHtml(source,zh)],{type:format==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`ads-source-${source.since}-${source.until}-${source.snapshot_id}.${format}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div style={{marginBlock:'1.5rem'}}><button type="button" className="button" onClick={()=>download('csv')}>{zh?'下载本版本报告（CSV）':'Download this report (CSV)'}</button> <button type="button" className="button" onClick={()=>download('html')}>{zh?'下载阅读版报告（可打印 PDF）':'Download readable report (print to PDF)'}</button><p>{zh?'包含期间汇总、每日明细和核对提示，可用 Excel 打开。阅读版下载后用浏览器打开，可打印或另存为 PDF。下载文件会保留当前数据状态。':'Includes period spend, daily rows and reconciliation notices. Open in Excel. The file retains the current source status.'}</p></div>;
}
