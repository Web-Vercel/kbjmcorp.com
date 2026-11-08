import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {AdsReadError,fetchAdsReport,reportingConfig,reportingDiagnostics} from '@/lib/ads/report-client';
import {completedWeek,parseAdsJson,spendMicros,summarize,formatMicros} from '@/lib/ads/report-model';
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
