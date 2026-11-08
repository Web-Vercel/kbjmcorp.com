import {z} from 'zod';
import {AdsReadError,type AdsFailure} from './read-errors';
function invalid(validation:NonNullable<AdsFailure['validation']>,details:Partial<AdsFailure>={}):never{throw new AdsReadError('invalid_response',{phase:'check',validation,...details});}
export const accountSchema=z.object({id:z.string().regex(/^adacct_[A-Za-z0-9_-]+$/),name:z.string().min(1).max(300),currency_code:z.string().regex(/^[A-Z]{3}$/),timezone:z.string().min(1).max(100),status:z.string().optional()});
export type AdsAccount=z.infer<typeof accountSchema>;
// Keep the exact decimal tokens from JSON. JSON.parse alone rounds numeric money first.
export function parseAdsJson(text:string):unknown{
 let out='',i=0;
 while(i<text.length){const ch=text[i];if(ch==='"'){const start=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')break;}out+=text.slice(start,i);}
 else if(ch==='-'||/\d/.test(ch)){const token=text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)?.[0];if(!token)throw new Error('Invalid JSON');out+=JSON.stringify(token);i+=token.length;}
 else{out+=ch;i++;}}
 return JSON.parse(out);
}
export function spendMicros(value:string):string{
 const m=/^(\d{1,12})(?:\.(\d+))?(?:[eE]([+-]?\d{1,2}))?$/.exec(value);if(!m)invalid('invalid_amount');
 const digits=m[1]+(m[2]||'');const power=6+Number(m[3]||0)-(m[2]?.length||0);if(Math.abs(power)>24)invalid('amount_precision',{precision:Math.max(0,(m[2]?.length||0)-Number(m[3]||0))});
 const n=BigInt(digits);let result:bigint;if(power>=0)result=n*10n**BigInt(power);else{const d=10n**BigInt(-power);if(n%d!==0n)invalid('amount_precision',{precision:Math.max(0,(m[2]?.length||0)-Number(m[3]||0))});result=n/d;}
 if(result>999999999999999999n)invalid('amount_range');return result.toString();
}
export function formatMicros(value:string):string{const n=BigInt(value);return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0')}`;}
export function localDate(now:Date,timezone:string):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(t:string)=>parts.find(p=>p.type===t)!.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(date:string,n:number):string{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function completedWeek(now:Date,timezone:string){const today=localDate(now,timezone);return {since:addDays(today,-7),until:addDays(today,-1)};}
// Resolve each calendar boundary separately: a week can span 167/169 hours at DST.
export function accountRangeSeconds(range:{since:string;until:string},timezone:string){
 function midnight(date:string):string{
  z.iso.date().parse(date);const target=Date.parse(date+'T00:00:00Z');let candidate=target;
  const format=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let attempt=0;attempt<6;attempt++){
   const parts=format.formatToParts(new Date(candidate));const get=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
   const wall=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));const delta=target-wall;
   if(delta===0)return String(candidate/1000);candidate+=delta;
  }
  invalid('timestamp',{expectedSince:date});
 }
 return {type:'unix_range' as const,start:midnight(range.since),end:midnight(addDays(range.until,1))};
}
const integer=z.union([z.string().regex(/^\d{1,16}$/),z.number().int().nonnegative().safe().transform(String)]);
const decimal=z.string().max(80);
export const insightPageSchema=z.object({object:z.literal('list'),data:z.array(z.object({id:z.string().min(1).max(2000),start_time:integer,end_time:integer,readable_time:z.string().optional(),timezone:z.string().optional(),ad_account_id:z.string().nullable().optional(),impressions:integer,clicks:integer,spend:decimal})).max(2000),count:z.coerce.number().int().min(0).max(2000),first_id:z.string().nullable(),last_id:z.string().nullable(),has_more:z.boolean(),timezone:z.string().optional()}).refine(p=>p.count===p.data.length);
export type InsightRow=z.infer<typeof insightPageSchema>['data'][number];
export type AdsReport={version:'ads-readonly-v1';account:AdsAccount;since:string;until:string;daily:{date:string;impressions:string;clicks:string;spendMicros:string}[];dailySpendMicros:string;periodSpendMicros:string|null;differenceMicros:string|null;check:'matched'|'difference'|'no_data';missingDates:string[];impressions:string;clicks:string;rawSha256:string;rawResponses:{path:string;body:string}[]};
function midnightDate(seconds:string,timezone:string,source:'daily'|'period'):string{
 const n=Number(seconds);if(!Number.isSafeInteger(n))invalid('timestamp',{source});const d=new Date(n*1000);const date=localDate(d,timezone);const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);const localTime=['hour','minute','second'].map(t=>parts.find(p=>p.type===t)!.value).join(':');if(localTime!=='00:00:00')invalid('partial_day',{source,actualSince:date,localTime});return date;
}
function sameTimezone(a:string,b:string){try{return new Intl.DateTimeFormat('en-US',{timeZone:a}).resolvedOptions().timeZone===new Intl.DateTimeFormat('en-US',{timeZone:b}).resolvedOptions().timeZone;}catch{return false;}}

export function summarize(account:AdsAccount,range:{since:string;until:string},daily:InsightRow[],totals:InsightRow[]):Omit<AdsReport,'version'|'rawSha256'|'rawResponses'>{
 if(totals.length>1)invalid('multiple_totals',{source:'period'});const dates=new Set<string>();
 const rows=daily.map(r=>{const date=midnightDate(r.start_time,account.timezone,'daily');if(r.readable_time&&/^\d{4}-\d{2}-\d{2}$/.test(r.readable_time)&&r.readable_time!==date)invalid('daily_label',{source:'daily',actualSince:date});if(r.timezone&&!sameTimezone(r.timezone,account.timezone))invalid('timezone',{source:'daily'});if(r.ad_account_id&&r.ad_account_id!==account.id)invalid('account',{source:'daily'});if(date<range.since||date>range.until||dates.has(date)||Number(r.end_time)<=Number(r.start_time))invalid('daily_bucket',{source:'daily',actualSince:date});const end=midnightDate(r.end_time,account.timezone,'daily');if(end!==addDays(date,1))invalid('daily_bucket',{source:'daily',actualSince:date,actualUntil:end});dates.add(date);return {date,impressions:r.impressions,clicks:r.clicks,spendMicros:spendMicros(r.spend)};}).sort((a,b)=>a.date.localeCompare(b.date));
 for(const r of totals){
  const since=midnightDate(r.start_time,account.timezone,'period'),until=midnightDate(r.end_time,account.timezone,'period');
  if(since!==range.since||until!==addDays(range.until,1))invalid('total_range',{source:'period',actualSince:since,actualUntil:until,expectedSince:range.since,expectedUntil:addDays(range.until,1)});
  if(r.ad_account_id&&r.ad_account_id!==account.id)invalid('account',{source:'period'});if(r.timezone&&!sameTimezone(r.timezone,account.timezone))invalid('timezone',{source:'period'});
 }
 const sum=(key:'spendMicros'|'impressions'|'clicks')=>rows.reduce((s,r)=>s+BigInt(r[key]),0n).toString();const dailySpendMicros=sum('spendMicros');const periodSpendMicros=totals.length?spendMicros(totals[0].spend):null;const differenceMicros=periodSpendMicros===null?null:(BigInt(dailySpendMicros)-BigInt(periodSpendMicros)).toString();
 const missingDates:string[]=[];for(let d=range.since;d<=range.until;d=addDays(d,1))if(!dates.has(d))missingDates.push(d);
 return {account,...range,daily:rows,dailySpendMicros,periodSpendMicros,differenceMicros,check:!rows.length||periodSpendMicros===null?'no_data':differenceMicros==='0'?'matched':'difference',missingDates,impressions:sum('impressions'),clicks:sum('clicks')};
}
