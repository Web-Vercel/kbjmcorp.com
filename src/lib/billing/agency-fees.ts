import {z} from 'zod';
import {cadSettlement,roundHalfUp} from './fx';
export const feeRuleSchema=z.object({
 mode:z.enum(['percentage','fixed','greater_of']),
 basis:z.enum(['platform_ad_spend','upstream_total']),
 basisPoints:z.number().int().min(0).max(10000),
 fixedMinor:z.string().regex(/^\d{1,10}$/),
 minimumMinor:z.string().regex(/^\d{1,10}$/),
 waiveWhenZero:z.boolean(),
});
export type AgencyFeeRule=z.infer<typeof feeRuleSchema>;
export function agencyFee(base:string,input:AgencyFeeRule):string{
 const r=feeRuleSchema.parse(input);if(!/^\d{1,10}$/.test(base))throw new Error('Invalid fee basis');
 const n=BigInt(base);if(n===0n&&r.waiveWhenZero)return '0';
 const proportional=roundHalfUp(n*BigInt(r.basisPoints),10000n);
 return (r.mode==='fixed'?BigInt(r.fixedMinor):r.mode==='percentage'?proportional:proportional>BigInt(r.minimumMinor)?proportional:BigInt(r.minimumMinor)).toString();
}
export function twoAgencyQuote(sourceCadMinor:string,rate:string,canada:AgencyFeeRule,china:AgencyFeeRule){
 if(canada.basis!=='platform_ad_spend')throw new Error('Canada fee basis must be platform spend');
 const ca=agencyFee(sourceCadMinor,canada);
 const upstream=(BigInt(sourceCadMinor)+BigInt(ca)).toString();
 const adCny=cadSettlement(sourceCadMinor,rate).adSpendMinor;
 const upstreamCny=cadSettlement(upstream,rate).adSpendMinor;
 // Convert the combined payable once; allocate the residual to the Canada fee.
 const caCny=(BigInt(upstreamCny)-BigInt(adCny)).toString();
 const basis=china.basis==='upstream_total'?upstreamCny:adCny;
 const cn=agencyFee(basis,china);
 return {sourceCadMinor,canadaFeeCadMinor:ca,upstreamCadMinor:upstream,adCnyMinor:adCny,canadaFeeCnyMinor:caCny,upstreamCnyMinor:upstreamCny,chinaFeeCnyMinor:cn,totalCnyMinor:(BigInt(upstreamCny)+BigInt(cn)).toString()};
}

export function decimalMinor(value:string):string{
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(value))throw new Error('Invalid monetary amount');
 const [whole,fraction='']=value.split('.');return (BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))).toString();
}
