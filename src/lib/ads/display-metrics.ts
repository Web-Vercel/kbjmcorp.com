// Display-only half-up rounding. Never round stored money before computing ratios.
export function displayRatio(numerator:bigint,denominator:bigint){
 if(denominator===0n)return '—';
 const negative=(numerator<0n)!==(denominator<0n),n=numerator<0n?-numerator:numerator,d=denominator<0n?-denominator:denominator;
 const cents=(n*100n+d/2n)/d;return `${negative&&cents!==0n?'-':''}${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}

export function clickThroughRate(impressions:string,clicks:string){const i=BigInt(impressions);return i===0n?'—':displayRatio(BigInt(clicks)*100n,i)+'%';}
