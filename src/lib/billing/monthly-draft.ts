import {createHash} from 'node:crypto';
import {z} from 'zod';
import {buildQuoteSnapshot,quoteDraftSchema} from './quote-snapshot';
import {savedPricingRate,resolvePricingRates} from './pricing-rates';
import {bocMonthWindow} from './boc-monthly';
export const monthlyDraftInput=z.object({requestId:z.uuid(),organizationId:z.uuid(),bindingId:z.uuid(),sourceId:z.uuid(),month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),agreement:z.string().trim().min(3).max(1000),confirm:z.literal('on')});
export type MonthlyDraftInput=z.infer<typeof monthlyDraftInput>;
export const monthlyDraftReference=z.object({rate:z.string(),date:z.iso.date(),source:z.literal('Bank of Canada'),series:z.literal('FXCNYCAD'),originalCnyCad:z.string(),fetchedAt:z.iso.datetime(),billingMonth:z.string(),policy:z.literal('month_end_last_published'),sourceUrl:z.url()});
export function buildMonthlyDraft(p:MonthlyDraftInput,source:{id:string;cadMinor:string},reference:unknown,system:unknown,customer:unknown,now=new Date()) {
 bocMonthWindow(p.month,now);
 if(source.id!==p.sourceId)throw new Error('Source mismatch');
 const ref=monthlyDraftReference.parse(reference);
 if(ref.billingMonth!==p.month||ref.date.slice(0,7)!==p.month)throw new Error('Reference month mismatch');
 const readRate=(row:unknown,org:string|null)=>{if(!row)return undefined;const r=savedPricingRate.parse(row);if(r.organization_id!==org||r.effective_month>p.month+'-01')throw new Error('Rate scope mismatch');return r;};
 const global=readRate(system,null),override=readRate(customer,p.organizationId);
 const rates=resolvePricingRates(global,override);
 const rule=(basis:'platform_ad_spend'|'upstream_total',basisPoints:number)=>({mode:'percentage' as const,basis,basisPoints,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true});
 const input=quoteDraftSchema.parse({requestId:p.requestId,organizationId:p.organizationId,period:p.month+'-01',sourceCadMinor:source.cadMinor,rateMode:'automatic',rate:ref.rate,referenceDate:ref.date,canada:rule('platform_ad_spend',rates.canada),china:rule('upstream_total',rates.china),transfer:{mode:'markup',basisPoints:rates.transfer,fixedMinor:'0',bearer:'customer',includedInRate:false},costUnit:'zhidian_cn',note:'Monthly automated calculation; independent review required.'});
 const snapshot={...buildQuoteSnapshot(input),referenceProof:ref,automation:{version:'monthly-draft-v1',sourceId:source.id,bindingId:p.bindingId,agreement:p.agreement,systemRevision:global?.revision??null,customerRevision:override?.revision??null}};
 return {snapshot,fingerprint:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
