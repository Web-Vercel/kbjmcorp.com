import 'server-only';
import {readPeriod,type ReadSelection} from './read-period';
import {createHash} from 'node:crypto';
import {accountSchema,accountRangeSeconds,insightPageSchema,parseAdsJson,summarize,type InsightRow,type AdsReport} from './report-model';
const base='https://api.ads.openai.com/v1';
export {AdsReadError} from './read-errors';
import {AdsReadError,safeNetworkCode,type AdsFailure} from './read-errors';
export function reportingDiagnostics(){
 const enabled=process.env.ADS_REPORTING_ENABLED?.trim().toLowerCase();const key=process.env.ADS_REPORTING_API_KEY?.trim();const accountId=process.env.ADS_REPORTING_ACCOUNT_ID?.trim();const currency=process.env.ADS_REPORTING_CURRENCY?.trim().toUpperCase();
 return [
 {name:'ADS_REPORTING_ENABLED',status:!enabled?'missing':enabled==='true'?'ready':enabled==='false'?'disabled':'invalid'},
 {name:'ADS_REPORTING_API_KEY',status:!key?'missing':/^[\x21-\x7e]+$/.test(key)?'ready':'invalid'},
 {name:'ADS_REPORTING_ACCOUNT_ID',status:!accountId?'missing':/^adacct_[A-Za-z0-9_-]+$/.test(accountId)?'ready':'invalid'},
 {name:'ADS_REPORTING_CURRENCY',status:!currency?'optional':/^[A-Z]{3}$/.test(currency)?'ready':'invalid'},
 ] as {name:string;status:'missing'|'ready'|'disabled'|'invalid'|'optional'}[];
}
export function reportingConfig(){
 if(reportingDiagnostics().some(d=>d.status!=='ready'&&d.status!=='optional'))return null;
 return {key:process.env.ADS_REPORTING_API_KEY!.trim(),accountId:process.env.ADS_REPORTING_ACCOUNT_ID!.trim(),currency:process.env.ADS_REPORTING_CURRENCY?.trim().toUpperCase()||null};
}
async function read(path:string,key:string,signal:AbortSignal,phase:AdsFailure['phase']){
 let r:Response;try{r=await fetch(base+path,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},redirect:'error',cache:'no-store',signal});}catch(e){throw new AdsReadError('upstream_unavailable',{phase,networkCode:safeNetworkCode(e,signal.aborted)});}
 if(r.status===401||r.status===403)throw new AdsReadError('upstream_auth',{phase,httpStatus:r.status});if(r.status===429)throw new AdsReadError('upstream_rate_limit',{phase,httpStatus:r.status});if(!r.ok||!r.body)throw new AdsReadError('upstream_unavailable',{phase,httpStatus:r.status});
 const reader=r.body.getReader();const chunks:Uint8Array[]=[];let bytes=0;try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>131072)throw new AdsReadError('invalid_response');chunks.push(value);}}catch(e){if(e instanceof AdsReadError)throw new AdsReadError(e.code,{phase,httpStatus:r.status});throw new AdsReadError('upstream_unavailable',{phase,networkCode:safeNetworkCode(e,signal.aborted)});}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks).toString('utf8');
}
export async function fetchAdsReport(now=new Date(),selection?:string|ReadSelection):Promise<AdsReport>{
 const config=reportingConfig();if(!config)throw new AdsReadError('not_configured');const key=config.key;const signal=AbortSignal.timeout(25000);const rawResponses:{path:string;body:string}[]=[];let phase:AdsFailure['phase']='account';
 try{
 const body=await read('/ad_account',config.key,signal,'account');rawResponses.push({path:'/ad_account',body});const account=accountSchema.parse(parseAdsJson(body));if(account.id!==config.accountId||(config.currency!==null&&account.currency_code!==config.currency))throw new AdsReadError('account_mismatch');
 const requested:ReadSelection=typeof selection==='string'?{mode:'month',month:selection}:selection||{mode:'week'};
 let range:{since:string;until:string};try{range=readPeriod(requested,now,account.timezone);}catch{throw new AdsReadError('invalid_period');}
 async function insights(granularity:'daily'|'none',window=range){
  const timeRange=accountRangeSeconds(window,account.timezone);
  phase=granularity==='daily'?'daily':'period';
  const rows:InsightRow[]=[];const cursors=new Set<string>();const ids=new Set<string>();let cursor:string|undefined;
  for(let page=0;page<5;page++){
   const q=new URLSearchParams({aggregation_level:'ad_account',time_granularity:granularity,limit:'100'});q.append('time_ranges[]',JSON.stringify(timeRange));q.append('includes[]','zero_impression_items');
   // Period totals have no daily bucket: do not project bucket-only metadata.
   const fields=['ad_account.id','ad_account.impressions','ad_account.clicks','ad_account.spend'];
   if(granularity==='daily')fields.push('metadata.readable_time','metadata.timezone');
   for(const field of fields)q.append('fields[]',field);if(cursor)q.set('after',cursor);
   const path='/ad_account/insights?'+q.toString();const body=await read(path,key,signal,phase);rawResponses.push({path,body});if(rawResponses.reduce((n,r)=>n+Buffer.byteLength(r.body),0)>524288)throw new AdsReadError('invalid_response');
   const parsed=insightPageSchema.parse(parseAdsJson(body));if(parsed.timezone&&parsed.timezone!==account.timezone)throw new AdsReadError('invalid_response');for(const row of parsed.data){if(ids.has(row.id))throw new AdsReadError('invalid_response');ids.add(row.id);rows.push(row);}if(!parsed.has_more)return rows;if(!parsed.last_id||cursors.has(parsed.last_id))throw new AdsReadError('invalid_response');cursors.add(parsed.last_id);cursor=parsed.last_id;
  }throw new AdsReadError('invalid_response');
 }
 const daily=await insights('daily');const totals=await insights('none');phase='check';let summary=summarize(account,range,daily,totals);
 if(summary.endBoundary==='last_day_label_unverified'){const probe=await insights('none',{since:range.until,until:range.until});phase='check';summary=summarize(account,range,daily,totals,probe);}
 if(requested.mode!=='week'&&summary.missingDates.length&&summary.coverageKind!=='aggregate_verified'&&summary.check==='matched')summary={...summary,check:'no_data'};
 return {version:'ads-readonly-v1',...summary,rawSha256:createHash('sha256').update(JSON.stringify(rawResponses)).digest('hex'),rawResponses};
 }catch(e){if(e instanceof AdsReadError)throw new AdsReadError(e.code,e.diagnostic||{phase});throw new AdsReadError('invalid_response',{phase});}
}
