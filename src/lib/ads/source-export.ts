import {addDays,formatMicros} from './report-model';
export type ExportSource={snapshot_id:string;account_name:string;currency:string;timezone:string;since:string;until:string;source_check:string;daily_spend_micros:string;period_spend_micros:string|null;missing_dates:string[];end_boundary:string|null;source_sha256:string;retrieved_at:string;shared_at:string;note:string;daily:{date:string;spend_micros:string;impressions:string;clicks:string}[]};
// Treat all strings as spreadsheet data, including advertiser names and staff notes.
function cell(value:string){const safe=/^[\s\uFEFF]*[=+\-@]/.test(value)?`'${value}`:value;return `"${safe.replaceAll('"','""')}"`;}
export function sourceCsv(s:ExportSource,zh:boolean){
 const t=(cn:string,en:string)=>zh?cn:en;
 const status=s.source_check==='matched'?t('花费数值一致，仍需正式复核','Spend matches; formal review still required'):s.source_check==='difference'?t('金额存在差异','Spend discrepancy'):t('数据或日期范围待核对','Data or date coverage needs review');
 const rows:string[][]=[
 [t('内部广告来源报告','Internal advertising source report')],
 [t('说明','Notice'),t('仅供内部核对，不是客户账单；不同版本日期可能重叠，不可累加；不包含服务费或人民币换算。','Internal review only, not a customer bill. Versions may overlap; do not add them. Excludes service fees and CNY conversion.')],
 [t('广告账户','Ad account'),s.account_name],[t('来源快照编号','Snapshot ID'),s.snapshot_id],
 [t('开始日期','Start date'),s.since],[t('结束日期','End date'),s.until],[t('账户时区','Account timezone'),s.timezone],[t('原始币种','Source currency'),s.currency],
 [t('核对状态','Reconciliation status'),status],
 [t('期间广告花费','Period advertising spend'),s.period_spend_micros===null?'':formatMicros(s.period_spend_micros)],
 [t('按日明细加总','Daily detail sum'),formatMicros(s.daily_spend_micros)],
 [t('缺少每日明细的日期（不按零花费计算）','Dates without daily detail (not zero spend)'),s.missing_dates.join('; ')],
 [t('日期边界核对标记','Date boundary check'),s.end_boundary||t('未提供','Not available')],
 [t('交接说明','Handoff note'),s.note],[t('来源获取时间','Retrieved at'),s.retrieved_at],[t('交接时间','Shared at'),s.shared_at],['SHA-256',s.source_sha256],[],
 [t('日期','Date'),t('广告花费（原币，六位小数）','Advertising spend (source currency, six decimals)'),t('展示次数','Impressions'),t('点击次数','Clicks'),t('明细状态','Detail status')]
 ];
 const daily=new Map(s.daily.map(d=>[d.date,d]));
 for(let date=s.since;date<=s.until;date=addDays(date,1)){
 const d=daily.get(date);rows.push(d?[date,formatMicros(d.spend_micros),d.impressions,d.clicks,t('已获取','Available')]:[date,'','','',t('缺少明细，不按零花费计算','Missing detail; not zero spend')]);
 }
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}

function html(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function sourceHtml(s:ExportSource,zh:boolean){
 const t=(cn:string,en:string)=>zh?cn:en;
 const title=t('广告表现来源报告','Advertising performance source report');
 const status=s.source_check==='matched'?t('花费数值一致，仍需正式复核','Spend matches; formal review still required'):s.source_check==='difference'?t('金额存在差异，请先调查','Spend discrepancy; investigate first'):t('数据或日期范围待核对','Data or date coverage needs review');
 const pair=(label:string,value:string)=>`<dt>${html(label)}</dt><dd>${html(value)}</dd>`;
 const daily=new Map(s.daily.map(d=>[d.date,d]));let body='';
 for(let date=s.since;date<=s.until;date=addDays(date,1)){
 const d=daily.get(date);body+=`<tr><td>${html(date)}</td><td>${d?formatMicros(d.spend_micros):'—'}</td><td>${d?html(d.impressions):'—'}</td><td>${d?html(d.clicks):'—'}</td><td>${html(d?t('已获取','Available'):t('缺少明细，不按零花费计算','Missing detail; not zero spend'))}</td></tr>`;
 }
 const impressions=s.daily.reduce((n,d)=>n+BigInt(d.impressions),0n),clicks=s.daily.reduce((n,d)=>n+BigInt(d.clicks),0n);
 return `<!doctype html><html lang="${zh?'zh-CN':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${html(title)}</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#123e35;max-width:1000px;margin:40px auto;padding:24px}h1{font-size:30px}h2{font-size:21px;margin-top:30px}.notice{padding:16px;background:#f1f5ec;border-left:4px solid #008c70}.total{font-size:32px;font-weight:700}dl{display:grid;grid-template-columns:minmax(130px,220px) 1fr;gap:8px 20px}dd{margin:0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce5d8}thead{display:table-header-group}tr{break-inside:avoid}.note{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:32px;font-size:13px;overflow-wrap:anywhere}@media print{@page{size:A4;margin:15mm}body{margin:0;padding:0;font-size:11pt;max-width:none}.print-help{display:none}h2{break-after:avoid}}</style></head><body><header><p>智点未来 · KBJM</p><h1>${html(title)}</h1><p>${html(s.account_name)}</p><p>${html(s.since)} → ${html(s.until)} · ${html(s.timezone)}</p></header><p class="notice">${html(t('内部来源报告，不是客户账单。不同版本日期可能重叠，不可累加。不包含服务费、税费或人民币换算；不会改变客户余额。','Internal source report, not a customer bill. Periods may overlap; do not add versions. Excludes service fees, taxes and CNY conversion; does not change customer balances.'))}</p><p class="print-help">${html(t('浏览器中按 ⌘P（Mac）或 Ctrl+P（Windows），可打印或另存为 PDF。','Use ⌘P (Mac) or Ctrl+P (Windows) to print or save as PDF.'))}</p><h2>${html(t('期间广告花费','Period advertising spend'))}</h2><p class="total">${html(s.period_spend_micros===null?t('暂无期间汇总','Period total unavailable'):`${s.currency} ${formatMicros(s.period_spend_micros)}`)}</p><dl>${pair(t('展示次数（已获取明细）','Impressions (available daily rows)'),impressions.toString())}${pair(t('点击次数（已获取明细）','Clicks (available daily rows)'),clicks.toString())}${pair(t('核对状态','Reconciliation status'),status)}${pair(t('按日明细加总','Daily detail sum'),`${s.currency} ${formatMicros(s.daily_spend_micros)}`)}${pair(t('缺少明细的日期','Dates without daily detail'),s.missing_dates.join(', ')||t('无','None'))}</dl><p>${html(t('缺少每日明细不表示零花费；展示与点击仅合计已获取明细。人工说明不改变程序核对状态。','Missing daily detail does not mean zero spend. Impressions and clicks sum available rows only. Manual notes do not change reconciliation status.'))}</p><h2>${html(t('每日广告明细','Daily advertising detail'))}</h2><p>${html(t('花费币种：','Spend currency: ')+s.currency)}</p><table><thead><tr>${[t('日期','Date'),t('花费','Spend'),t('展示','Impressions'),t('点击','Clicks'),t('明细状态','Detail status')].map(v=>`<th>${html(v)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table><h2>${html(t('交接说明','Handoff note'))}</h2><p class="note">${html(s.note)}</p><footer><dl>${pair(t('来源快照编号','Snapshot ID'),s.snapshot_id)}${pair(t('来源获取时间','Retrieved at'),s.retrieved_at)}${pair(t('交接时间','Shared at'),s.shared_at)}${pair(t('日期边界标记','Date boundary marker'),s.end_boundary||t('未提供','Not available'))}${pair('SHA-256',s.source_sha256)}</dl><p>${html(t('本报告基于已保存的 API 来源版本生成，不是 OpenAI 官方发票；下载后不会自动更新。','Generated from a saved API source version, not an official OpenAI invoice. Downloaded copies do not update automatically.'))}</p></footer></body></html>`;
}
