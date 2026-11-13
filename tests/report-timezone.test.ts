import {expect,it} from 'vitest';
import {sameReportingTimezone,summarize,accountRangeSeconds} from '@/lib/ads/report-model';
import {diagnosticTimezone} from '@/lib/ads/report-timezone';
import {failureLabel} from '@/lib/ads/read-errors';
it('accepts different IANA names only when every reporting day has the same boundaries',()=>{
 expect(sameReportingTimezone('America/Vancouver','America/Los_Angeles',{since:'2025-10-01',until:'2025-11-03'})).toBe(true);
 expect(sameReportingTimezone('Etc/UTC','UTC',{since:'2026-10-01',until:'2026-10-31'})).toBe(true);
 expect(sameReportingTimezone('America/Phoenix','America/Los_Angeles',{since:'2026-11-01',until:'2026-11-30'})).toBe(false);
 expect(sameReportingTimezone('UTC','America/Vancouver',{since:'2026-10-01',until:'2026-10-31'})).toBe(false);
 expect(sameReportingTimezone('PRIVATE-RAW','America/Vancouver',{since:'2026-10-01',until:'2026-10-31'})).toBe(false);
});
it('retains strict timezone failure and reports only validated timezone names',()=>{
 const account={id:'adacct_fixture',name:'FICTIONAL',currency_code:'CAD',timezone:'America/Vancouver'};
 const window={since:'2026-10-01',until:'2026-10-01'},times=accountRangeSeconds(window,account.timezone);
 const row={id:'fixture',start_time:times.start,end_time:times.end,impressions:'0',clicks:'0',spend:'0',timezone:'UTC'};
 expect(()=>summarize(account,window,[row],[])).toThrow();
 try{summarize(account,window,[row],[]);}catch(e){const error=e as {diagnostic:unknown};expect(failureLabel(error.diagnostic,true)).toContain('账户时区=America/Vancouver');expect(failureLabel(error.diagnostic,true)).toContain('返回时区=UTC');}
 expect(summarize(account,window,[{...row,timezone:'America/Los_Angeles'}],[]).daily).toHaveLength(1);
 expect(diagnosticTimezone('PRIVATE-RAW')).toBe('unrecognized');
 expect(failureLabel({phase:'check',validation:'timezone',actualTimezone:'PRIVATE-RAW'},true)).toBe('');
});
