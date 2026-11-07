import {roundHalfUp} from './fx';
export type TransferCost={mode:'none'|'fixed'|'markup'|'gross_up';basisPoints:number;fixedMinor:string;bearer:'agency'|'customer';includedInRate:boolean};
export function crossBorderCost(baseMinor:string,cost:TransferCost){
 if(!/^\d+$/.test(baseMinor)||!/^\d{1,10}$/.test(cost.fixedMinor)||!Number.isInteger(cost.basisPoints)||cost.basisPoints<0||cost.basisPoints>10000)throw new Error('Invalid transfer cost');
 if(cost.includedInRate&&cost.mode!=='none')throw new Error('Cost included in rate; do not charge again');
 if(!['agency','customer'].includes(cost.bearer))throw new Error('Invalid cost bearer');
 const base=BigInt(baseMinor);let amount=0n;
 if(cost.mode==='fixed')amount=BigInt(cost.fixedMinor);
 else if(cost.mode==='markup')amount=roundHalfUp(base*BigInt(cost.basisPoints),10000n);
 else if(cost.mode==='gross_up'){
  if(cost.basisPoints===10000)throw new Error('Invalid gross-up percentage');
  const denominator=10000n-BigInt(cost.basisPoints);
  amount=(base*10000n+denominator-1n)/denominator-base;
 }else if(cost.mode!=='none')throw new Error('Invalid transfer mode');
 return {costMinor:amount.toString(),customerCostMinor:cost.bearer==='customer'?amount.toString():'0',agencyCostMinor:cost.bearer==='agency'?amount.toString():'0'};
}
