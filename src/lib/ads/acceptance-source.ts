import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {accountSchema,calendarMonthRange} from './report-model';
const integer=z.string().regex(/^\d{1,18}$/);
const schema=z.object({version:z.literal('ads-readonly-v1'),account:accountSchema,since:z.iso.date(),until:z.iso.date(),check:z.literal('matched'),dailySpendMicros:integer,periodSpendMicros:integer,rawSha256:z.string().regex(/^[a-f0-9]{64}$/),coverageKind:z.enum(['complete_rows','aggregate_verified']),startBoundary:z.literal('requested'),endBoundary:z.enum(['exclusive','last_day_label_verified']),periodRange:z.object({since:z.iso.date(),until:z.iso.date()}),missingDates:z.array(z.iso.date()).max(31),impressions:integer,clicks:integer,periodImpressions:integer,periodClicks:integer,differenceMicros:z.literal('0'),daily:z.array(z.object({date:z.iso.date(),impressions:integer,clicks:integer,spendMicros:integer})).min(1).max(31),utcMetadata:z.boolean().optional()});
function hash(value:string){return createHash('sha256').update(value).digest('hex');}
export function acceptanceSourceCopy(input:unknown,sourceId:string,organizationId:string,originalOrganizationId:string){
 const report=schema.parse(input);z.uuid().parse(sourceId);z.uuid().parse(organizationId);z.uuid().parse(originalOrganizationId);
 const month=calendarMonthRange(report.since);
 if(month.since!==report.since||month.until!==report.until||report.account.id.startsWith('adacct_acceptance_')||report.account.currency_code!=='CAD'||report.dailySpendMicros!==report.periodSpendMicros)throw Error('Source not ready');
 for(const field of ['spendMicros','impressions','clicks'] as const){const total=report.daily.reduce((s,r)=>s+BigInt(r[field]),0n);const expected=field==='spendMicros'?report.periodSpendMicros:field==='impressions'?report.periodImpressions:report.periodClicks;if(total!==BigInt(expected))throw Error('Source totals differ');}
 const provenance={kind:'acceptance-copy-not-payable',sourceSnapshotId:sourceId,sourceAccountId:report.account.id,sourceOrganizationId:originalOrganizationId,sourceRawSha256:report.rawSha256,sourceSince:report.since,sourceUntil:report.until,targetOrganizationId:organizationId};
 // Stable per real advertiser + test enterprise, NOT per snapshot or month.
 const accountId='adacct_acceptance_'+hash(report.account.id+'|'+organizationId).slice(0,32);
 const requestHash=hash('acceptance-copy-v1|'+sourceId+'|'+organizationId);
 const requestId=`${requestHash.slice(0,8)}-${requestHash.slice(8,12)}-4${requestHash.slice(13,16)}-8${requestHash.slice(17,20)}-${requestHash.slice(20,32)}`;
 const rawResponses=[{path:'acceptance://source/'+sourceId,body:JSON.stringify(provenance)}];
 return {requestId,report:{...report,account:{...report.account,id:accountId,name:'财务流程验收账户（副本，非真实广告账户）'},rawSha256:hash(JSON.stringify(rawResponses)),rawResponses,acceptanceProvenance:provenance,readSelection:{mode:'month' as const,month:report.since}},reference:'ACCEPTANCE TEST ONLY: source '+sourceId+'; original ownership unchanged; no payment.'};
}
