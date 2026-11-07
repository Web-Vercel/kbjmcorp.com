import {expect,it} from 'vitest';
import {agencyFee,twoAgencyQuote,decimalMinor,type AgencyFeeRule} from '@/lib/billing/agency-fees';
const zero:AgencyFeeRule={mode:'percentage',basis:'platform_ad_spend',basisPoints:0,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
it('keeps platform costs unchanged and allocates separate agency revenues exactly',()=>{
 const q=twoAgencyQuote('100000','5.20',{...zero,basisPoints:1000},{...zero,mode:'fixed',fixedMinor:'58000'});
 expect(q).toEqual({sourceCadMinor:'100000',canadaFeeCadMinor:'10000',upstreamCadMinor:'110000',adCnyMinor:'520000',canadaFeeCnyMinor:'52000',upstreamCnyMinor:'572000',chinaFeeCnyMinor:'58000',totalCnyMinor:'630000'});
});
it('does not silently compound China fees: its basis is explicit',()=>{const ca={...zero,basisPoints:1000};expect(twoAgencyQuote('100000','5',ca,{...zero,basisPoints:1000}).chinaFeeCnyMinor).toBe('50000');expect(twoAgencyQuote('100000','5',ca,{...zero,basis:'upstream_total',basisPoints:1000}).chinaFeeCnyMinor).toBe('55000');});
it('uses greater-of minimum, never minimum plus percentage',()=>{expect(agencyFee('10000',{...zero,mode:'greater_of',basisPoints:1000,minimumMinor:'5000'})).toBe('5000');expect(agencyFee('100000',{...zero,mode:'greater_of',basisPoints:1000,minimumMinor:'5000'})).toBe('10000');});
it('honors zero-basis policy and exact fractional-cent rounding',()=>{expect(agencyFee('0',{...zero,mode:'fixed',fixedMinor:'5000'})).toBe('0');expect(agencyFee('0',{...zero,mode:'fixed',fixedMinor:'5000',waiveWhenZero:false})).toBe('5000');expect(agencyFee('1',{...zero,basisPoints:5000})).toBe('1');const q=twoAgencyQuote('1','1.5',{...zero,mode:'fixed',fixedMinor:'1'},zero);expect(BigInt(q.adCnyMinor)+BigInt(q.canadaFeeCnyMinor)).toBe(BigInt(q.upstreamCnyMinor));});
it('rejects invalid rules and parses human money without floats',()=>{expect(decimalMinor('1000.01')).toBe('100001');expect(()=>decimalMinor('1.001')).toThrow();expect(()=>agencyFee('100',{...zero,basisPoints:10001})).toThrow();expect(()=>twoAgencyQuote('100','5',{...zero,basis:'upstream_total'},zero)).toThrow();});
