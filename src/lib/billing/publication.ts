import {restoreQuoteSeed,buildQuoteSnapshot} from './quote-snapshot';
/** Recompute the locked quote before posting; historical agreed rates are not refreshed. */
export function checkedPublicationQuote(snapshot:unknown,context:{id:string;organizationId:string;period:string}){
 const calculated=buildQuoteSnapshot(restoreQuoteSeed(snapshot,context));
 const stored=snapshot as Record<string,unknown>;
 const keys=['sourceCadMinor','canadaFeeCadMinor','upstreamCadMinor','adCnyMinor','canadaFeeCnyMinor','upstreamCnyMinor','chinaFeeCnyMinor','totalCnyMinor','costMinor','customerCostMinor','agencyCostMinor','finalMinor'] as const;
 for(const key of keys)if(stored[key]!==calculated[key])throw new Error('Stored quote does not match recalculation');
 if(BigInt(calculated.finalMinor)>9999999999n)throw new Error('Posting exceeds ledger limit');
 return snapshot;
}
