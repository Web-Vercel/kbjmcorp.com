// Display-only half-up rounding. Never round stored money before computing ratios.
export function displayRatio(numerator:bigint,denominator:bigint){
 if(denominator===0n)return '—';
 const negative=(numerator<0n)!==(denominator<0n),n=numerator<0n?-numerator:numerator,d=denominator<0n?-denominator:denominator;
 const cents=(n*100n+d/2n)/d;return `${negative&&cents!==0n?'-':''}${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}
export function displayMetrics(spendMinor:string,impressions:string,clicks:string){const spend=BigInt(spendMinor),i=BigInt(impressions),c=BigInt(clicks);return {ctr:i===0n?'—':displayRatio(c*100n,i)+'%',cpc:c===0n?'—':displayRatio(spend,c*100n),cpm:i===0n?'—':displayRatio(spend*1000n,i*100n)};}
