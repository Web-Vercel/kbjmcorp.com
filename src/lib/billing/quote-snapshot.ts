import {z} from 'zod';
import {feeRuleSchema,twoAgencyQuote} from './agency-fees';
import {rateUnits} from './fx';
import {crossBorderCost} from './cross-border';
const minor=z.string().regex(/^\d{1,10}$/);
export const quoteDraftSchema=z.object({
 parentQuoteId:z.uuid().optional(),
 requestId:z.uuid(),organizationId:z.uuid(),period:z.iso.date().refine(v=>v.endsWith('-01')),
 sourceCadMinor:minor,rateMode:z.enum(['manual','automatic']),
 rate:z.string().refine(v=>{try{rateUnits(v);return true;}catch{return false;}}),
 referenceDate:z.iso.date().optional(),
 canada:feeRuleSchema.refine(r=>r.basis==='platform_ad_spend'),china:feeRuleSchema,
 transfer:z.object({mode:z.enum(['none','fixed','markup','gross_up']),basisPoints:z.number().int().min(0).max(10000),fixedMinor:minor,bearer:z.enum(['agency','customer']),includedInRate:z.boolean()}),
 costUnit:z.enum(['kbjm_ca','zhidian_cn']).default('zhidian_cn'),
 note:z.string().trim().min(3).max(1000),
}).refine(p=>p.rateMode!=='automatic'||(!!p.referenceDate&&!p.transfer.includedInRate));
export type QuoteDraftInput=z.infer<typeof quoteDraftSchema>;
export function buildQuoteSnapshot(input:QuoteDraftInput){
 const p=quoteDraftSchema.parse(input);
 const q=twoAgencyQuote(p.sourceCadMinor,p.rate,p.canada,p.china);
 const cost=crossBorderCost(q.upstreamCnyMinor,p.transfer);
 return {calculationVersion:'two-agency-v1',status:'draft',rateMode:p.rateMode,rate:p.rate,referenceDate:p.referenceDate||null,
  source:p.rateMode==='automatic'?'Bank of Canada':'Manual administrator input',
  canadaRule:p.canada,chinaRule:p.china,transferRule:p.transfer,
  ...q,...cost,costUnit:p.costUnit,finalMinor:(BigInt(q.totalCnyMinor)+BigInt(cost.customerCostMinor)).toString(),note:p.note};
}

export type QuoteSeed=QuoteDraftInput;
export function restoreQuoteSeed(snapshot:unknown,context:{id:string;organizationId:string;period:string}):QuoteSeed{
 const s=z.object({calculationVersion:z.literal('two-agency-v1'),sourceCadMinor:z.string(),rateMode:z.enum(['manual','automatic']),rate:z.string(),referenceDate:z.string().nullable().optional(),canadaRule:feeRuleSchema,chinaRule:feeRuleSchema,transferRule:z.unknown()}).passthrough().parse(snapshot);
 return quoteDraftSchema.parse({requestId:context.id,parentQuoteId:context.id,organizationId:context.organizationId,period:context.period,
 sourceCadMinor:s.sourceCadMinor,rateMode:s.rateMode,rate:s.rate,referenceDate:s.referenceDate||undefined,canada:s.canadaRule,china:s.chinaRule,transfer:s.transferRule,costUnit:s.costUnit,note:s.note});
}
export function minorInput(value:string):string{const n=BigInt(value);return `${n/100n}.${(n%100n).toString().padStart(2,'0')}`;}
