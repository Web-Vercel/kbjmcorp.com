// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act} from '@testing-library/react';
import Form from '@/components/operations/UpstreamActionForm';
const id='b0000000-0000-4000-8000-000000000001',other='c0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function view(action:'review'|'reversal_submit'|'reversal_review'='review'){render(<Form locale="zh" action={action} targetId={id} company={id} month="2026-10" button="提交"><input name="action" type="hidden" value={action}/><input name="decision" type="hidden" value="approved"/><input name="note" aria-label="说明" defaultValue="FICTIONAL original evidence"/></Form>);}
const submit=()=>fireEvent.submit(screen.getByRole('button').closest('form')!);
it('locates original payment/reversal receipts with the exact company and month',async()=>{
 for(const action of ['review','reversal_submit','reversal_review'] as const){const receipt={id:action==='reversal_submit'?other:id,action,stage:action==='reversal_submit'?'registered':'approved',...(action==='reversal_submit'?{paymentId:id}:{})};vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receipt})));view(action);submit();const link=await screen.findByRole('link',{name:'查看原 CAD 核对记录'});expect(link.getAttribute('href')).toBe(`/zh/operations/upstream-payments?company=${id}&month=2026-10#${action==='review'?'upstream-payment':'upstream-reversal'}-${receipt.id}`);expect(screen.getByText(/不再次扣客户余额/)).toBeTruthy();cleanup();}
});
it('does not trust a wrong record, wrong action, opposite decision or missing receipt',async()=>{
 for(const receipt of [null,{id:other,action:'review',stage:'approved'},{id,action:'reversal_review',stage:'approved'},{id,action:'review',stage:'rejected'}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receipt})));view();submit();await screen.findByRole('alert');expect((screen.getByLabelText('说明') as HTMLInputElement).value).toBe('FICTIONAL original evidence');expect(screen.queryByRole('link',{name:'查看原 CAD 核对记录'})).toBeNull();cleanup();}
});
it('retains evidence after timeout and never automatically retries',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('timeout')))));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button').closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('说明') as HTMLInputElement).value).toBe('FICTIONAL original evidence');
});
