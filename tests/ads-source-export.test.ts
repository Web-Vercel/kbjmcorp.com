import {it,expect} from 'vitest';
import {sourceCsv,type ExportSource} from '../src/lib/ads/source-export';
const source:ExportSource={snapshot_id:'example',account_name:'=HYPERLINK("bad")',currency:'CAD',timezone:'America/Vancouver',since:'2026-01-01',until:'2026-01-02',source_check:'no_data',daily_spend_micros:'1234567',period_spend_micros:null,missing_dates:['2026-01-02'],end_boundary:'last_day_label_unverified',source_sha256:'examplehash',retrieved_at:'2026-01-03T00:00:00Z',shared_at:'2026-01-03T01:00:00Z',note:' \t+formula\n"note"',daily:[{date:'2026-01-01',spend_micros:'1234567',impressions:'10',clicks:'1'}]};
it('exports exact spend, pending status and blank missing-day values instead of zeros',()=>{
 const csv=sourceCsv(source,true);expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain('"1.234567"');expect(csv).toContain('数据或日期范围待核对');expect(csv).toContain('"期间广告花费",""');expect(csv).toContain('"2026-01-02","","","","缺少明细，不按零花费计算"');
});
it('escapes CSV quotes and neutralizes formula-bearing names and multiline notes',()=>{
 const csv=sourceCsv(source,false);expect(csv).toContain('"\'=HYPERLINK(""bad"")"');expect(csv).toContain('"\' \t+formula\n""note"""');expect(csv).toContain('not a customer bill');expect(csv).not.toContain('API_KEY');
});
