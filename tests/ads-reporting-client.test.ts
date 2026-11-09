import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {AdsReadError,fetchAdsReport,reportingConfig,reportingDiagnostics} from '@/lib/ads/report-client';
import {accountRangeSeconds,completedMonthRange,calendarMonthRange,addDays,completedWeek,parseAdsJson,spendMicros,summarize,formatMicros} from '@/lib/ads/report-model';
const account={id:'adacct_fictional',name:'FICTIONAL ACCOUNT',currency_code:'CAD',timezone:'UTC'};
const row={id:'row-1',start_time:'1792886400',end_time:'1792972800',readable_time:'2026-10-25',ad_account_id:account.id,impressions:'1000',clicks:'30',spend:'18.420001'};
const page=(data:object[],more=false,last:string|null='row-1')=>({object:'list',data,count:data.length,first_id:data.length?'row-1':null,last_id:last,has_more:more});
const fetcher=vi.fn();
beforeEach(()=>{vi.stubEnv('ADS_REPORTING_ENABLED','true');vi.stubEnv('ADS_REPORTING_API_KEY','TEST-NOT-A-REAL-KEY');vi.stubEnv('ADS_REPORTING_ACCOUNT_ID',account.id);vi.stubEnv('ADS_REPORTING_CURRENCY','CAD');vi.stubGlobal('fetch',fetcher);fetcher.mockReset();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('preserves exact numeric money tokens including exponent notation',()=>{const parsed=parseAdsJson('{"spend":9007199254.740993,"value":1e-6,"name":"the number 123"}') as Record<string,string>;expect(spendMicros(parsed.spend)).toBe('9007199254740993');expect(spendMicros(parsed.value)).toBe('1');expect(parsed.name).toBe('the number 123');expect(formatMicros('18420001')).toBe('18.420001');expect(()=>spendMicros('1e-7')).toThrow();expect(()=>spendMicros('-1')).toThrow();});
it('uses account-local completed days across DST',()=>{expect(completedWeek(new Date('2026-11-08T02:00:00Z'),'America/Vancouver')).toEqual({since:'2026-10-31',until:'2026-11-06'});});
it('only GETs fixed official paths, paginates and compares exact totals without padding missing days',async()=>{
 const next={...row,id:'row-2',start_time:'1792972800',end_time:'1793059200',readable_time:'2026-10-26',spend:'0.000001'};
 const total={...row,id:'total',start_time:'1792886400',end_time:'1793491200',readable_time:undefined,spend:'18.420002'};
 fetcher.mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(Response.json(page([row],true,'cursor-1'))).mockResolvedValueOnce(Response.json(page([next]))).mockResolvedValueOnce(Response.json(page([total])));
 const report=await fetchAdsReport(new Date('2026-11-01T12:00:00Z'));expect(report.check).toBe('matched');expect(report.dailySpendMicros).toBe('18420002');expect(report.missingDates).toHaveLength(5);expect(report.rawResponses).toHaveLength(4);
 for(const [url,options] of fetcher.mock.calls){expect(new URL(url).origin).toBe('https://api.ads.openai.com');expect(options.method).toBe('GET');expect(options.redirect).toBe('error');}
 const query=new URL(fetcher.mock.calls[1][0]).searchParams;expect(query.get('aggregation_level')).toBe('ad_account');expect(query.get('fields[]')).toBe('ad_account.id');expect(new URL(fetcher.mock.calls[2][0]).searchParams.get('after')).toBe('cursor-1');expect(JSON.stringify(report)).not.toContain('TEST-NOT-A-REAL-KEY');
});
it('fails closed on account mismatch, unavailable spend, or repeated pagination instead of saving partial data',async()=>{
 fetcher.mockResolvedValueOnce(Response.json({...account,id:'adacct_wrong'}));await expect(fetchAdsReport()).rejects.toMatchObject({code:'account_mismatch'});expect(fetcher).toHaveBeenCalledTimes(1);
 fetcher.mockReset().mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(Response.json(page([{...row,spend:null}])));await expect(fetchAdsReport()).rejects.toMatchObject({code:'invalid_response'});
 fetcher.mockReset().mockResolvedValueOnce(Response.json(account)).mockResolvedValue(Response.json(page([row],true,'same')));await expect(fetchAdsReport()).rejects.toMatchObject({code:'invalid_response'});
});
it('does not infer zero or approval from missing rows or inconsistent totals',()=>{
 const range={since:'2026-10-25',until:'2026-10-31'};expect(summarize(account,range,[],[]).check).toBe('no_data');const total={...row,start_time:'1792886400',end_time:'1793491200',spend:'20'};expect(summarize(account,range,[row],[total]).check).toBe('difference');expect(()=>summarize(account,range,[row,row],[total])).toThrow();expect(()=>summarize(account,range,[{...row,start_time:'1792886401'}],[total])).toThrow();expect(()=>summarize(account,range,[row],[{...total,end_time:row.end_time}])).toThrow();
});
it('redacts upstream errors and never reads an error body',async()=>{const response=new Response('private upstream content',{status:403});const read=vi.spyOn(response,'text');fetcher.mockResolvedValue(response);await expect(fetchAdsReport()).rejects.toMatchObject({code:'upstream_auth',diagnostic:{phase:'account',httpStatus:403}});expect(read).not.toHaveBeenCalled();vi.stubEnv('ADS_REPORTING_ENABLED','false');fetcher.mockClear();await expect(fetchAdsReport()).rejects.toMatchObject({code:'not_configured'});expect(fetcher).not.toHaveBeenCalled();});

it('diagnoses each missing or malformed configuration without revealing values, and normalizes surrounding whitespace',()=>{
 vi.stubEnv('ADS_REPORTING_ENABLED',' true ');vi.stubEnv('ADS_REPORTING_CURRENCY',' cad ');vi.stubEnv('ADS_REPORTING_ACCOUNT_ID',' adacct_fictional ');vi.stubEnv('ADS_REPORTING_API_KEY',' TEST-NOT-A-REAL-KEY ');expect(reportingConfig()).toEqual({key:'TEST-NOT-A-REAL-KEY',accountId:'adacct_fictional',currency:'CAD'});expect(reportingDiagnostics().every(d=>d.status==='ready')).toBe(true);expect(JSON.stringify(reportingDiagnostics())).not.toContain('TEST-NOT-A-REAL-KEY');vi.stubEnv('ADS_REPORTING_API_KEY','');vi.stubEnv('ADS_REPORTING_ACCOUNT_ID','WRONG PRIVATE ACCOUNT');expect(reportingConfig()).toBeNull();expect(reportingDiagnostics()).toContainEqual({name:'ADS_REPORTING_API_KEY',status:'missing'});expect(reportingDiagnostics()).toContainEqual({name:'ADS_REPORTING_ACCOUNT_ID',status:'invalid'});expect(JSON.stringify(reportingDiagnostics())).not.toContain('WRONG PRIVATE ACCOUNT');
});

it('reads the authoritative account currency when the optional currency pin is absent',async()=>{
 vi.stubEnv('ADS_REPORTING_CURRENCY','');expect(reportingConfig()?.currency).toBeNull();expect(reportingDiagnostics()).toContainEqual({name:'ADS_REPORTING_CURRENCY',status:'optional'});fetcher.mockResolvedValueOnce(Response.json({...account,currency_code:'USD'})).mockResolvedValueOnce(Response.json(page([],false,null))).mockResolvedValueOnce(Response.json(page([],false,null)));const report=await fetchAdsReport(new Date('2026-11-01T12:00:00Z'));expect(report.account.currency_code).toBe('USD');expect(report.check).toBe('no_data');expect(report.periodSpendMicros).toBeNull();
});
it('still rejects a mismatch when an expected currency is explicitly configured',async()=>{fetcher.mockResolvedValueOnce(Response.json({...account,currency_code:'USD'}));await expect(fetchAdsReport()).rejects.toMatchObject({code:'account_mismatch'});expect(fetcher).toHaveBeenCalledTimes(1);});

it('identifies the failed read phase and HTTP status without reflecting provider text',async()=>{
 fetcher.mockResolvedValueOnce(new Response('SECRET error body',{status:404}));await expect(fetchAdsReport()).rejects.toMatchObject({code:'upstream_unavailable',diagnostic:{phase:'account',httpStatus:404}});
 fetcher.mockReset().mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(new Response('SECRET error body',{status:500}));await expect(fetchAdsReport()).rejects.toMatchObject({code:'upstream_unavailable',diagnostic:{phase:'daily',httpStatus:500}});
 fetcher.mockReset().mockRejectedValueOnce(Object.assign(new Error('SECRET error text'),{cause:{code:'ENOTFOUND'}}));await expect(fetchAdsReport()).rejects.toMatchObject({code:'upstream_unavailable',diagnostic:{phase:'account',networkCode:'dns'}});
});

it('requests totals without daily-bucket fields and keeps the same account, dates and metrics',async()=>{
 const total={...row,id:'total',start_time:'1792886400',end_time:'1793491200',readable_time:undefined};
 fetcher.mockImplementation(async(url:string)=>{const parsed=new URL(url);if(parsed.pathname.endsWith('/ad_account'))return Response.json(account);const q=parsed.searchParams;if(q.get('time_granularity')==='none'){if(q.getAll('fields[]').some(f=>f==='metadata.readable_time'||f==='metadata.timezone'))return new Response('Unsupported bucket field',{status:400});return Response.json(page([total]));}return Response.json(page([row]));});
 const report=await fetchAdsReport(new Date('2026-11-01T12:00:00Z'));expect(report.check).toBe('matched');const daily=new URL(fetcher.mock.calls[1][0]).searchParams;const period=new URL(fetcher.mock.calls[2][0]).searchParams;expect(period.get('time_ranges[]')).toBe(daily.get('time_ranges[]'));expect(period.get('aggregation_level')).toBe('ad_account');expect(period.getAll('fields[]')).toEqual(['ad_account.id','ad_account.impressions','ad_account.clicks','ad_account.spend']);expect(daily.getAll('fields[]')).toContain('metadata.readable_time');
});

it('reports precise validation reasons while preserving strict amount and date checks',()=>{
 const range={since:'2026-10-25',until:'2026-10-31'};const total={...row,start_time:'1792886400',end_time:'1793491200'};
 try{summarize(account,range,[{...row,spend:'18.4200011'}],[total]);throw new Error('unexpected pass');}catch(e){expect(e).toMatchObject({code:'invalid_response',diagnostic:{phase:'check',validation:'amount_precision',precision:7}});}
 try{summarize(account,range,[row],[{...total,end_time:row.end_time}]);throw new Error('unexpected pass');}catch(e){expect(e).toMatchObject({diagnostic:{validation:'total_range',source:'period',actualSince:'2026-10-25',actualUntil:'2026-10-26',expectedSince:'2026-10-25',expectedUntil:'2026-11-01'}});}
 try{summarize(account,range,[{...row,start_time:'1792886401'}],[total]);throw new Error('unexpected pass');}catch(e){expect(e).toMatchObject({diagnostic:{validation:'partial_day',source:'daily',localTime:'00:00:01'}});}
});
it('uses timestamps rather than display-only labels and accepts canonical timezone aliases',()=>{const total={...row,start_time:'1792886400',end_time:'1793491200',timezone:'Etc/UTC'};const result=summarize(account,{since:'2026-10-25',until:'2026-10-31'},[{...row,readable_time:'Oct 25, 2026',timezone:'Etc/UTC'}],[total]);expect(result.check).toBe('matched');expect(result.daily[0].date).toBe('2026-10-25');expect(()=>summarize(account,{since:'2026-10-25',until:'2026-10-31'},[{...row,readable_time:'2026-10-26'}],[total])).toThrow();});

it('uses explicit exclusive timestamp boundaries for the observed seven-day window across DST',()=>{
 const range=accountRangeSeconds({since:'2026-10-31',until:'2026-11-06'},'America/Toronto');expect(range.type).toBe('unix_range');expect(new Date(Number(range.start)*1000).toISOString()).toBe('2026-10-31T04:00:00.000Z');expect(new Date(Number(range.end)*1000).toISOString()).toBe('2026-11-07T05:00:00.000Z');expect(Number(range.end)-Number(range.start)).toBe(169*3600);
 const spring=accountRangeSeconds({since:'2026-03-07',until:'2026-03-13'},'America/Toronto');expect(Number(spring.end)-Number(spring.start)).toBe(167*3600);
 const half=accountRangeSeconds({since:'2026-10-31',until:'2026-11-06'},'Asia/Kolkata');expect(new Date(Number(half.start)*1000).toISOString()).toBe('2026-10-30T18:30:00.000Z');
});
it('sends exactly the same explicit inclusive-start/exclusive-end timestamps to daily and total requests',async()=>{
 fetcher.mockImplementation(async(url:string)=>{const u=new URL(url);if(u.pathname.endsWith('/ad_account'))return Response.json(account);const q=u.searchParams;const range=JSON.parse(q.get('time_ranges[]')!);if(range.type!=='unix_range')return new Response('ambiguous date range',{status:400});return Response.json(page([{...row,id:q.get('time_granularity')==='none'?'period':'daily',start_time:range.start,end_time:q.get('time_granularity')==='none'?range.end:String(Number(range.start)+86400)}]));});
 const report=await fetchAdsReport(new Date('2026-11-01T12:00:00Z'));expect(report.check).toBe('matched');const queries=fetcher.mock.calls.slice(1).map(c=>JSON.parse(new URL(c[0]).searchParams.get('time_ranges[]')!));expect(queries).toEqual([{type:'unix_range',start:'1792886400',end:'1793491200'},{type:'unix_range',start:'1792886400',end:'1793491200'}]);
});
it('does not assume an inclusive end label proves coverage; verifies it using a separate positive last-day report',()=>{
 const range={since:'2026-10-25',until:'2026-10-31'};
 const last={...row,id:'last-day',start_time:'1793404800',end_time:'1793491200',readable_time:'2026-10-31',spend:'2'};
 const total={...row,id:'period',start_time:'1792886400',end_time:'1793404800',spend:'20.420001'};
 const probe={...last,id:'probe',end_time:last.start_time};
 const unverified=summarize(account,range,[row,last],[total]);expect(unverified.endBoundary).toBe('last_day_label_unverified');expect(unverified.check).toBe('no_data');
 const verified=summarize(account,range,[row,last],[total],[probe]);expect(verified.endBoundary).toBe('last_day_label_verified');expect(verified.check).toBe('matched');expect(total.end_time).toBe('1793404800');
 const truncated=summarize(account,range,[row,last],[{...total,spend:row.spend}],[probe]);expect(truncated.check).toBe('difference');
 expect(summarize(account,range,[row,last],[total],[{...probe,spend:'0',clicks:'0',impressions:'0'}]).check).toBe('no_data');
 expect(summarize(account,range,[row],[{...total,spend:row.spend}],[probe]).check).toBe('no_data');
 expect(()=>summarize(account,range,[row,last],[total],[{...probe,ad_account_id:'adacct_wrong'}])).toThrow();
});
it('fetches and retains the last-day verification separately when aggregate end metadata uses an inclusive label',async()=>{
 const last={...row,id:'last-day',start_time:'1793404800',end_time:'1793491200',readable_time:'2026-10-31',spend:'2'};
 fetcher.mockImplementation(async(url:string)=>{const u=new URL(url);if(u.pathname.endsWith('/ad_account'))return Response.json(account);const q=u.searchParams;const r=JSON.parse(q.get('time_ranges[]')!);if(q.get('time_granularity')==='daily')return Response.json(page([row,last]));if(r.start==='1793404800')return Response.json(page([{...last,id:'probe',end_time:r.start}]));return Response.json(page([{...row,id:'period',start_time:r.start,end_time:'1793404800',spend:'20.420001'}]));});
 const report=await fetchAdsReport(new Date('2026-11-01T12:00:00Z'));expect(report.endBoundary).toBe('last_day_label_verified');expect(report.check).toBe('matched');expect(report.rawResponses).toHaveLength(4);expect(JSON.parse(new URL(fetcher.mock.calls[3][0]).searchParams.get('time_ranges[]')!)).toEqual({type:'unix_range',start:'1793404800',end:'1793491200'});expect(report.rawResponses[2].body).toContain('1793404800');
});

it('uses a closed complete month in account-local time, including leap years and retention limits',()=>{
 expect(calendarMonthRange('2024-02-01')).toEqual({since:'2024-02-01',until:'2024-02-29'});
 expect(calendarMonthRange('2026-12-01')).toEqual({since:'2026-12-01',until:'2026-12-31'});
 expect(()=>completedMonthRange('2026-11-01',new Date('2026-12-01T03:00:00Z'),'America/Vancouver')).toThrow();
 expect(completedMonthRange('2026-11-01',new Date('2026-12-01T12:00:00Z'),'America/Vancouver').until).toBe('2026-11-30');
 expect(()=>completedMonthRange('2025-10-01',new Date('2026-11-09T12:00:00Z'),'UTC')).toThrow();
 expect(()=>calendarMonthRange('2026-10-06')).toThrow();
});
it('requests full-month daily rows and totals, and does not mark missing monthly coverage as matched',async()=>{
 const since='2026-10-01',until='2026-10-31';const daily=[];
 for(let date=since;date<=until;date=addDays(date,1)){daily.push({...row,id:date,start_time:String(Date.parse(date+'T00:00:00Z')/1000),end_time:String(Date.parse(addDays(date,1)+'T00:00:00Z')/1000),readable_time:date,spend:'1.000001'});}
 const total={...row,id:'total',start_time:daily[0].start_time,end_time:daily[30].end_time,readable_time:undefined,spend:'31.000031'};
 fetcher.mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(Response.json(page(daily))).mockResolvedValueOnce(Response.json(page([total])));
 const complete=await fetchAdsReport(new Date('2026-11-09T12:00:00Z'),since);expect(complete.since).toBe(since);expect(complete.until).toBe(until);expect(complete.check).toBe('matched');expect(complete.dailySpendMicros).toBe('31000031');
 const q=new URL(fetcher.mock.calls[1][0]).searchParams;expect(JSON.parse(q.get('time_ranges[]')!)).toEqual(accountRangeSeconds({since,until},'UTC'));
 fetcher.mockReset().mockResolvedValueOnce(Response.json(account)).mockResolvedValueOnce(Response.json(page(daily.slice(0,30)))).mockResolvedValueOnce(Response.json(page([{...total,spend:'30.000030'}])));
 const missing=await fetchAdsReport(new Date('2026-11-09T12:00:00Z'),since);expect(missing.check).toBe('no_data');expect(missing.missingDates).toEqual(['2026-10-31']);
 fetcher.mockReset().mockResolvedValueOnce(Response.json(account));await expect(fetchAdsReport(new Date('2026-11-09T12:00:00Z'),'2026-11-01')).rejects.toMatchObject({code:'invalid_period'});expect(fetcher).toHaveBeenCalledTimes(1);
});
