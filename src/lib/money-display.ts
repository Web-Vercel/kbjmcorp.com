/** Presentation only: integer source units -> two decimal currency units, half away from zero. */
export function currencyRatio(numerator:bigint,denominator:bigint):string{
 if(denominator<=0n)return '—';
 const negative=numerator<0n,absolute=negative?-numerator:numerator;
 const cents=(absolute*100n+denominator/2n)/denominator;
 return (negative&&cents!==0n?'−':'')+(cents/100n).toLocaleString('en-US')+'.'+(cents%100n).toString().padStart(2,'0');
}
export function currencyUnits(value:string|bigint,scale:2|6){return currencyRatio(BigInt(value),10n**BigInt(scale));}
export function currencyUnitCost(spendMicros:bigint,count:bigint,multiplier=1n){return count>0n?currencyRatio(spendMicros*multiplier,count*1000000n):'—';}
