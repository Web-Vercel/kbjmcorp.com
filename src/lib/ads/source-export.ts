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
