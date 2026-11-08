import 'server-only';
import {createHash} from 'node:crypto';
import {accountSchema,completedWeek,insightPageSchema,parseAdsJson,summarize,type InsightRow,type AdsReport} from './report-model';
const base='https://api.ads.openai.com/v1';
export class AdsReadError extends Error{constructor(public code:'not_configured'|'upstream_auth'|'upstream_rate_limit'|'upstream_unavailable'|'invalid_response'|'account_mismatch'){super(code);}}
export function reportingDiagnostics(){
 const enabled=process.env.ADS_REPORTING_ENABLED?.trim().toLowerCase();const key=process.env.ADS_REPORTING_API_KEY?.trim();const accountId=process.env.ADS_REPORTING_ACCOUNT_ID?.trim();const currency=process.env.ADS_REPORTING_CURRENCY?.trim().toUpperCase();
 return [
 {name:'ADS_REPORTING_ENABLED',status:!enabled?'missing':enabled==='true'?'ready':enabled==='false'?'disabled':'invalid'},
 {name:'ADS_REPORTING_API_KEY',status:!key?'missing':/^[\x21-\x7e]+$/.test(key)?'ready':'invalid'},
 {name:'ADS_REPORTING_ACCOUNT_ID',status:!accountId?'missing':/^adacct_[A-Za-z0-9_-]+$/.test(accountId)?'ready':'invalid'},
 {name:'ADS_REPORTING_CURRENCY',status:!currency?'missing':/^[A-Z]{3}$/.test(currency)?'ready':'invalid'},
 ] as {name:string;status:'missing'|'ready'|'disabled'|'invalid'}[];
}
export function reportingConfig(){
 if(reportingDiagnostics().some(d=>d.status!=='ready'))return null;
 return {key:process.env.ADS_REPORTING_API_KEY!.trim(),accountId:process.env.ADS_REPORTING_ACCOUNT_ID!.trim(),currency:process.env.ADS_REPORTING_CURRENCY!.trim().toUpperCase()};
}
async function read(path:string,key:string,signal:AbortSignal){
 let r:Response;try{r=await fetch(base+path,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},redirect:'error',cache:'no-store',signal});}catch{throw new AdsReadError('upstream_unavailable');}
 if(r.status===401||r.status===403)throw new AdsReadError('upstream_auth');if(r.status===429)throw new AdsReadError('upstream_rate_limit');if(!r.ok||!r.body)throw new AdsReadError('upstream_unavailable');
 const reader=r.body.getReader();const chunks:Uint8Array[]=[];let bytes=0;try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>131072)throw new AdsReadError('invalid_response');chunks.push(value);}}finally{await reader.cancel();}return Buffer.concat(chunks).toString('utf8');
}
export async function fetchAdsReport(now=new Date()):Promise<AdsReport>{
 const config=reportingConfig();if(!config)throw new AdsReadError('not_configured');const key=config.key;const signal=AbortSignal.timeout(25000);const rawResponses:{path:string;body:string}[]=[];
 try{
 const body=await read('/ad_account',config.key,signal);rawResponses.push({path:'/ad_account',body});const account=accountSchema.parse(parseAdsJson(body));if(account.id!==config.accountId||account.currency_code!==config.currency)throw new AdsReadError('account_mismatch');
 const range=completedWeek(now,account.timezone);
 async function insights(granularity:'daily'|'none'){
  const rows:InsightRow[]=[];const cursors=new Set<string>();const ids=new Set<string>();let cursor:string|undefined;
  for(let page=0;page<5;page++){
   const q=new URLSearchParams({aggregation_level:'ad_account',time_granularity:granularity,limit:'100'});q.append('time_ranges[]',JSON.stringify({type:'date_range',...range,timezone:account.timezone}));
   for(const field of ['ad_account.id','ad_account.impressions','ad_account.clicks','ad_account.spend','metadata.readable_time','metadata.timezone'])q.append('fields[]',field);if(cursor)q.set('after',cursor);
   const path='/ad_account/insights?'+q.toString();const body=await read(path,key,signal);rawResponses.push({path,body});if(rawResponses.reduce((n,r)=>n+Buffer.byteLength(r.body),0)>524288)throw new AdsReadError('invalid_response');
   const parsed=insightPageSchema.parse(parseAdsJson(body));if(parsed.timezone&&parsed.timezone!==account.timezone)throw new AdsReadError('invalid_response');for(const row of parsed.data){if(ids.has(row.id))throw new AdsReadError('invalid_response');ids.add(row.id);rows.push(row);}if(!parsed.has_more)return rows;if(!parsed.last_id||cursors.has(parsed.last_id))throw new AdsReadError('invalid_response');cursors.add(parsed.last_id);cursor=parsed.last_id;
  }throw new AdsReadError('invalid_response');
 }
 const daily=await insights('daily');const totals=await insights('none');return {version:'ads-readonly-v1',...summarize(account,range,daily,totals),rawSha256:createHash('sha256').update(JSON.stringify(rawResponses)).digest('hex'),rawResponses};
 }catch(e){if(e instanceof AdsReadError)throw e;throw new AdsReadError('invalid_response');}
}
