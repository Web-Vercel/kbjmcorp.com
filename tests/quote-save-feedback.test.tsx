// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import Calculator from '@/components/operations/AgencyQuoteCalculator';
import {buildQuoteSnapshot,restoreQuoteSeed,type QuoteDraftInput} from '@/lib/billing/quote-snapshot';
const org='b0000000-0000-4000-8000-000000000001',parent='c0000000-0000-4000-8000-000000000001',saved='d0000000-0000-4000-8000-000000000001';
const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:0,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
const input:QuoteDraftInput={organizationId:org,period:'2026-10-01',requestId:parent,sourceCadMinor:'100000',rateMode:'manual',rate:'5.2',canada:rule,china:rule,transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},note:'FICTIONAL QUOTE',costUnit:'zhidian_cn'};
const initial=()=>restoreQuoteSeed(buildQuoteSnapshot(input),{id:parent,organizationId:org,period:input.period});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function view(){render(<Calculator locale="zh" initial={initial()} companies={[{id:org,name:'FICTIONAL COMPANY'}]}/>);fireEvent.submit(screen.getByRole('button',{name:'试算两家公司费用'}).closest('form')!);}
const save=()=>fireEvent.click(screen.getByRole('button',{name:'保存为新报价版本（保留原报价）'}));
it('locks estimate inputs and repeated saves while the original proposal is in flight',async()=>{
 let resolve!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetcher);view();save();expect((screen.getByLabelText('平台原始广告费（CAD）').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'保存中…'}));expect(fetcher).toHaveBeenCalledOnce();await act(async()=>resolve(Response.json({ok:true,id:saved})));expect(screen.getByRole('status').textContent).toContain(saved);
});
it('preserves the estimate and request key after a 30-second unknown result, and retries unchanged',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE TIMEOUT'))))).mockResolvedValue(Response.json({ok:true,id:saved}));vi.stubGlobal('fetch',fetcher);view();save();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('平台原始广告费（CAD）') as HTMLInputElement).value).toBe('1000.00');expect((screen.getByLabelText('平台原始广告费（CAD）').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);expect(screen.getByRole('link',{name:'核查本企业本月历史报价'}).getAttribute('href')).toBe(`/zh/operations/pricing?company=${org}&month=2026-10#saved-quotes`);await act(async()=>save());expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);expect(screen.getByRole('status').textContent).toContain(saved);expect(screen.queryByText(/PRIVATE/)).toBeNull();
});
it('does not accept a malformed quote ID as a saved version',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,id:'invalid'})));view();save();await screen.findByRole('alert');expect(screen.queryByRole('status')).toBeNull();expect(screen.queryByRole('button',{name:'报价草稿已保存'})).toBeNull();
});
it('explains reference or access errors without inventing a saved quote or discarding the estimate',async()=>{
 for(const [error,text,status] of [['reference_changed','参考汇率已变化',409],['unauthenticated','登录已过期',401],['forbidden','管理员身份',403]] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();save();await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain(text));expect((screen.getByLabelText('平台原始广告费（CAD）') as HTMLInputElement).value).toBe('1000.00');expect((screen.getByLabelText('平台原始广告费（CAD）').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(false);expect(screen.queryByRole('status')).toBeNull();cleanup();}
});
