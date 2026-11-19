import {z} from 'zod';
// An explicit public projection: never serialize internal quote/source objects to clients.
const integer=z.string().regex(/^(0|[1-9]\d{0,29})$/);
const date=z.iso.date();
export const clientStatementSchema=z.object({
 id:z.uuid(),wallet_id:z.uuid().optional(),organization_id:z.uuid().optional(),organization_name:z.string().max(500),month:date.refine(v=>v.endsWith('-01')),currency:z.literal('CNY'),
 advertising_service_minor:integer,operating_other_minor:integer,total_minor:integer,
 summary_zh:z.string().max(10000),published_at:z.iso.datetime({offset:true}),
 usage:z.object({coverage_kind:z.enum(['complete_rows','aggregate_verified','reviewed_activity','reviewed_zero','not_active','manual_cost_only']).optional(),account_name:z.string().max(1000),since:date,until:date,timezone:z.string().max(100),impressions:integer.nullable(),clicks:integer.nullable(),
 daily:z.array(z.object({date,impressions:integer,clicks:integer,origin:z.enum(['api','aggregate_zero','reviewed_no_activity','not_active']).optional()})).max(31)})
}).refine(s=>s.usage.coverage_kind==='manual_cost_only'?(s.usage.impressions===null&&s.usage.clicks===null&&s.usage.daily.length===0):(s.usage.impressions!==null&&s.usage.clicks!==null),{message:'Missing performance must be explicit for manual cost-only sources'}).refine(s=>BigInt(s.advertising_service_minor)+BigInt(s.operating_other_minor)===BigInt(s.total_minor),{message:'Statement charges differ from total'});
export type ClientStatement=z.infer<typeof clientStatementSchema>;
export const statementMoney=(v:string)=>`${BigInt(v)/100n}.${String(BigInt(v)%100n).padStart(2,'0')}`;
export function statementPublishedAt(value:string,zh:boolean){return new Intl.DateTimeFormat(zh?'zh-CN':'en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))+' (America/Vancouver)';}
