// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {act,cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({refresh:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>m}));
import Form from '@/components/operations/MonthlySettlementForm';
const id='d0000000-0000-4000-8000-000000000001',org='b0000000-0000-4000-8000-000000000001';
function view(mode:'prepare'|'review'='prepare'){
 return render(<Form locale="zh" mode={mode} draftId={mode==='review'?id:undefined} company={org} month="2026-10" button="提交测试"><input name="action" type="hidden" value={mode}/><input name="note" aria-label="说明" defaultValue="Original fictional note"/><input name="snapshotId" type="hidden" value={id}/><input name="quoteId" type="hidden" value={id}/><input name="draftId" type="hidden" value={id}/><input name="decision" aria-label="复核决定" defaultValue="approved"/></Form>);
}
function submit(){fireEvent.submit(screen.getByRole('button',{name:'提交测试'}).closest('form')!);}
beforeEach(()=>vi.clearAllMocks());afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
it('locates the confirmed draft and preserves company/month for independent-review handoff',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,draftId:id,receipt:{action:'prepare',draftId:id,snapshotId:id,quoteId:id}})});vi.stubGlobal('fetch',fetcher);view();submit();
 await screen.findByText(/已确认月度结算草稿记录/);expect(screen.getByRole('link',{name:'定位此结算草稿及复核状态'}).getAttribute('href')).toBe(`/zh/operations/settlements?company=${org}&month=2026-10#draft-${id}`);expect(m.refresh).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.getByText(/客户账单发布与余额记账由管理员另行办理/)).toBeDefined();
});
it('treats missing or mismatched review receipts as unknown, retaining inputs and offering an explicit refresh',async()=>{
 for(const result of [{ok:true},{ok:true,draftId:'e0000000-0000-4000-8000-000000000001'}]){
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>result}));view('review');submit();await screen.findByRole('alert');expect((screen.getByLabelText('说明') as HTMLInputElement).value).toBe('Original fictional note');expect(screen.queryByText(/独立复核结果已保存/)).toBeNull();expect(m.refresh).not.toHaveBeenCalled();expect(screen.getByRole('link',{name:'查看本企业本月结算记录'}).getAttribute('target')).toBe('_blank');cleanup();m.refresh.mockClear();
 }
});
it('does not double-submit while pending and retries unchanged input after an uncertain response',async()=>{
 let reject!:(e:Error)=>void;const fetcher=vi.fn().mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;})).mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,draftId:id,receipt:{action:'prepare',draftId:id,snapshotId:id,quoteId:id}})});vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button',{name:'正在提交…'}).closest('form')!);expect(fetcher).toHaveBeenCalledTimes(1);await act(async()=>reject(new Error('PRIVATE NETWORK ERROR')));await screen.findByRole('alert');submit();await screen.findByText(/已确认月度结算草稿记录/);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);expect(screen.queryByText(/PRIVATE NETWORK/)).toBeNull();
});
it('ends the spinner after the 30-second timeout without claiming failure or success',async()=>{
 vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))));view();submit();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(screen.getByRole('alert').textContent).toContain('提交结果待核查');expect((screen.getByRole('button',{name:'提交测试'}) as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByText(/已确认月度结算草稿记录/)).toBeNull();
});
it('keeps permission and conflict errors distinct from a confirmed review',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({error:'conflict',message:'PRIVATE DATABASE ERROR'})}));view('review');submit();await screen.findByText(/原记录或提交内容已变化/);expect(screen.queryByText(/独立复核结果已保存/)).toBeNull();expect(screen.queryByText(/PRIVATE DATABASE/)).toBeNull();expect(m.refresh).not.toHaveBeenCalled();
});
it('retains input for expired sessions and confirms a valid review against the original draft',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:401}).mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,draftId:id,receipt:{action:'review',draftId:id,decision:'approved'}})});vi.stubGlobal('fetch',fetcher);view('review');submit();await screen.findByText(/登录已过期/);expect(m.push).not.toHaveBeenCalled();submit();await screen.findByText(/独立复核结果已保存/);expect(m.refresh).not.toHaveBeenCalled();
});

it('records a rejection receipt without presenting it as an approval',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,draftId:id,receipt:{action:'review',draftId:id,decision:'rejected'}})}));view('review');fireEvent.change(screen.getByLabelText('复核决定'),{target:{value:'rejected'}});submit();await screen.findByText(/本次复核结果：退回，需修订后重新制单/);expect(screen.queryByText('本次复核结果：通过')).toBeNull();
});

it('rejects a swapped source, quote or opposite review decision',async()=>{
 const other='e0000000-0000-4000-8000-000000000001';
 for(const [mode,receipt] of [['prepare',{action:'prepare',draftId:id,snapshotId:other,quoteId:id}],['prepare',{action:'prepare',draftId:id,snapshotId:id,quoteId:other}],['review',{action:'review',draftId:id,decision:'rejected'}]] as const){
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,draftId:id,receipt})}));view(mode);submit();await screen.findByRole('alert');expect((screen.getByLabelText('说明') as HTMLInputElement).value).toContain('Original');expect(m.refresh).not.toHaveBeenCalled();cleanup();
 }
});
