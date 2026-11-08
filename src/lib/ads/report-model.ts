import {z} from 'zod';
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
 const m=/^(\d{1,12})(?:\.(\d+))?(?:[eE]([+-]?\d{1,2}))?$/.exec(value);if(!m)throw new Error('Invalid spend');
 const digits=m[1]+(m[2]||'');const power=6+Number(m[3]||0)-(m[2]?.length||0);if(Math.abs(power)>24)throw new Error('Spend precision');
 const n=BigInt(digits);let result:bigint;if(power>=0)result=n*10n**BigInt(power);else{const d=10n**BigInt(-power);if(n%d!==0n)throw new Error('Spend precision');result=n/d;}
 if(result>999999999999999999n)throw new Error('Spend too large');return result.toString();
}
export function formatMicros(value:string):string{const n=BigInt(value);return `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0')}`;}
export function localDate(now:Date,timezone:string):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(t:string)=>parts.find(p=>p.type===t)!.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(date:string,n:number):string{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function completedWeek(now:Date,timezone:string){const today=localDate(now,timezone);return {since:addDays(today,-7),until:addDays(today,-1)};}
const integer=z.union([z.string().regex(/^\d{1,16}$/),z.number().int().nonnegative().safe().transform(String)]);
const decimal=z.string().max(80);
export const insightPageSchema=z.object({object:z.literal('list'),data:z.array(z.object({id:z.string().min(1).max(2000),start_time:integer,end_time:integer,readable_time:z.string().optional(),timezone:z.string().optional(),ad_account_id:z.string().nullable().optional(),impressions:integer,clicks:integer,spend:decimal})).max(2000),count:z.coerce.number().int().min(0).max(2000),first_id:z.string().nullable(),last_id:z.string().nullable(),has_more:z.boolean(),timezone:z.string().optional()}).refine(p=>p.count===p.data.length);
export type InsightRow=z.infer<typeof insightPageSchema>['data'][number];
export type AdsReport={version:'ads-readonly-v1';account:AdsAccount;since:string;until:string;daily:{date:string;impressions:string;clicks:string;spendMicros:string}[];dailySpendMicros:string;periodSpendMicros:string|null;differenceMicros:string|null;check:'matched'|'difference'|'no_data';missingDates:string[];impressions:string;clicks:string;rawSha256:string;rawResponses:{path:string;body:string}[]};
function midnightDate(seconds:string,timezone:string):string{
 const n=Number(seconds);if(!Number.isSafeInteger(n))throw new Error('Invalid timestamp');const d=new Date(n*1000);const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);if(parts.some(p=>['hour','minute','second'].includes(p.type)&&p.value!=='00'))throw new Error('Partial day');return localDate(d,timezone);
}
export function summarize(account:AdsAccount,range:{since:string;until:string},daily:InsightRow[],totals:InsightRow[]):Omit<AdsReport,'version'|'rawSha256'|'rawResponses'>{
 if(totals.length>1)throw new Error('Ambiguous total');const dates=new Set<string>();
 const rows=daily.map(r=>{const date=midnightDate(r.start_time,account.timezone);if(r.readable_time&&r.readable_time!==date)throw new Error('Date mismatch');if(r.timezone&&r.timezone!==account.timezone)throw new Error('Timezone mismatch');if(r.ad_account_id&&r.ad_account_id!==account.id)throw new Error('Account mismatch');if(date<range.since||date>range.until||dates.has(date)||Number(r.end_time)<=Number(r.start_time))throw new Error('Invalid daily bucket');const end=midnightDate(r.end_time,account.timezone);if(end!==addDays(date,1))throw new Error('Incomplete daily bucket');dates.add(date);return {date,impressions:r.impressions,clicks:r.clicks,spendMicros:spendMicros(r.spend)};}).sort((a,b)=>a.date.localeCompare(b.date));
 for(const r of totals)if(midnightDate(r.start_time,account.timezone)!==range.since||midnightDate(r.end_time,account.timezone)!==addDays(range.until,1)||(r.ad_account_id&&r.ad_account_id!==account.id)||(r.timezone&&r.timezone!==account.timezone))throw new Error('Scope mismatch');
 const sum=(key:'spendMicros'|'impressions'|'clicks')=>rows.reduce((s,r)=>s+BigInt(r[key]),0n).toString();const dailySpendMicros=sum('spendMicros');const periodSpendMicros=totals.length?spendMicros(totals[0].spend):null;const differenceMicros=periodSpendMicros===null?null:(BigInt(dailySpendMicros)-BigInt(periodSpendMicros)).toString();
 const missingDates:string[]=[];for(let d=range.since;d<=range.until;d=addDays(d,1))if(!dates.has(d))missingDates.push(d);
 return {account,...range,daily:rows,dailySpendMicros,periodSpendMicros,differenceMicros,check:!rows.length||periodSpendMicros===null?'no_data':differenceMicros==='0'?'matched':'difference',missingDates,impressions:sum('impressions'),clicks:sum('clicks')};
}
