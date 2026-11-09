import {formatMicros} from '@/lib/ads/report-model';
export type PerformanceSource={currency:string;since:string;until:string;daily_spend_micros:string;period_spend_micros:string|null;missing_dates:string[];daily:{date:string;spend_micros:string;impressions:string;clicks:string}[]};
// Ratios are display-only; all money remains exact integer millionths.
export function displayRatio(numerator:bigint,denominator:bigint){
 if(denominator===0n)return '—';
 const cents=(numerator*100n+denominator/2n)/denominator;
 return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}
export default function AdsPerformanceReport({source:s,zh}:{source:PerformanceSource;zh:boolean}){
 const impressions=s.daily.reduce((n,d)=>n+BigInt(d.impressions),0n),clicks=s.daily.reduce((n,d)=>n+BigInt(d.clicks),0n);
 const dailySpend=BigInt(s.daily_spend_micros);
 const cards=[
  [zh?'期间广告花费':'Period advertising spend',s.period_spend_micros===null?(zh?'暂无期间汇总':'Period total unavailable'):`${s.currency} ${formatMicros(s.period_spend_micros)}`],
  [zh?'展示次数（已获取明细）':'Impressions (available daily rows)',impressions.toLocaleString(zh?'zh-CN':'en-CA')],
  [zh?'点击次数（已获取明细）':'Clicks (available daily rows)',clicks.toLocaleString(zh?'zh-CN':'en-CA')],
  [zh?'点击率':'Click-through rate',impressions===0n?'—':`${displayRatio(clicks*100n,impressions)}%`],
  [zh?'平均每次点击成本':'Average cost per click',clicks===0n?'—':`${s.currency} ${displayRatio(dailySpend,clicks*1000000n)}`],
  [zh?'每千次展示成本':'Cost per thousand impressions',impressions===0n?'—':`${s.currency} ${displayRatio(dailySpend*1000n,impressions*1000000n)}`],
 ];
 return <section aria-label={zh?'广告表现报告':'Advertising performance report'} style={{marginBlock:'1.5rem'}}><h3>{zh?'期间广告表现':'Period advertising performance'}</h3><p>{zh?'统计期间：':'Reporting period: '}{s.since} → {s.until}</p><dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'1.25rem',marginBlock:'1.5rem'}}>{cards.map(([label,value])=><div key={label} style={{padding:'1rem',border:'1px solid #dce5d8',borderRadius:8}}><dt>{label}</dt><dd style={{margin:'0.5rem 0 0',fontSize:'1.3rem',fontWeight:700}}>{value}</dd></div>)}</dl><p>{zh?'点击率、每次点击成本及每千次展示成本由已获取的每日明细计算，仅供表现分析；缺少明细时不代表完整期间表现。原始花费保留六位小数，分析指标保留两位。':'CTR, CPC and CPM are calculated from available daily rows for performance analysis. Missing rows mean these metrics may not cover the full period. Source spend retains six decimal places; analytical metrics use two.'}</p><details><summary>{zh?'查看金额核对详情':'View spend reconciliation'}</summary><p>{zh?'按日明细加总：':'Daily detail sum: '}{s.currency} {formatMicros(s.daily_spend_micros)}</p><p>{zh?'平台期间汇总：':'Platform period total: '}{s.period_spend_micros===null?'—':`${s.currency} ${formatMicros(s.period_spend_micros)}`}</p><p>{zh?'金额差额（明细加总减期间汇总）：':'Difference (daily sum minus period total): '}{s.period_spend_micros===null?'—':(()=>{const delta=dailySpend-BigInt(s.period_spend_micros);return `${s.currency} ${delta<0n?'-':''}${formatMicros((delta<0n?-delta:delta).toString())}`;})()}</p></details></section>;
}
