import type {AdsReport} from './report-model';
export type SourceHistoryRow={id:string;account_id:string;account_name:string;currency:string;timezone:string;since:string;until:string;check_status:string;created_at:string;report:AdsReport};
/** Group full matching scopes, never sum repeated reads or merge overlapping ranges. */
export function groupSourceHistory<T extends SourceHistoryRow>(rows:T[]){
 const grouped=new Map<string,T[]>();
 for(const row of rows){const key=JSON.stringify([row.account_id,row.since,row.until,row.currency,row.timezone]);const list=grouped.get(key)||[];list.push(row);grouped.set(key,list);}
 return [...grouped.values()].map(versions=>{
  versions.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
  const reconciled=(row:T)=>row.check_status==='matched'&&row.report.check==='matched'&&row.report.periodSpendMicros!==null&&row.report.periodSpendMicros===row.report.dailySpendMicros&&row.report.startBoundary!=='later_start_unverified'&&['exclusive','last_day_label_verified'].includes(row.report.endBoundary||'');
  const current=versions.find(reconciled)||versions[0];
  return {current,versions,latest:versions[0],reconciled:reconciled(current)};
 }).sort((a,b)=>b.latest.created_at.localeCompare(a.latest.created_at)||b.latest.id.localeCompare(a.latest.id));
}
export function sameSourceSummary(a:SourceHistoryRow,b:SourceHistoryRow){
 return a.report.periodSpendMicros===b.report.periodSpendMicros&&a.report.dailySpendMicros===b.report.dailySpendMicros&&a.report.impressions===b.report.impressions&&a.report.clicks===b.report.clicks;
}
