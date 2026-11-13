import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Report,{displayRatio,type PerformanceSource} from '../src/components/operations/AdsPerformanceReport';
const source:PerformanceSource={currency:'CAD',since:'2026-01-01',until:'2026-01-07',daily_spend_micros:'152640000',period_spend_micros:'152640000',missing_dates:['2026-01-07'],daily:[{date:'2026-01-01',spend_micros:'152640000',impressions:'9090',clicks:'102'}]};
describe('source performance report',()=>{
 it('calculates display ratios with exact integer rounding and zero denominators',()=>{
 expect(displayRatio(10200n,9090n)).toBe('1.12');
 expect(displayRatio(152640000n,102000000n)).toBe('1.50');
 expect(displayRatio(152640000000n,9090000000n)).toBe('16.79');
 expect(displayRatio(1n,0n)).toBe('—');
 });
 it('distinguishes platform period total from incomplete daily-derived metrics',()=>{
 const html=renderToStaticMarkup(<Report source={source} zh/>);
 expect(html).toContain('期间广告花费');expect(html).toContain('CAD 152.640000');expect(html).toContain('不代表完整期间表现');expect(html).toContain('1.12%');
 const empty=renderToStaticMarkup(<Report source={{...source,daily:[],daily_spend_micros:'0',period_spend_micros:null}} zh/>);
 expect(empty).toContain('暂无期间汇总');expect(empty).not.toContain('NaN');expect(empty).not.toContain('Infinity');
 });
});
