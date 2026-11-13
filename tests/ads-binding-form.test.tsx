// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act} from '@testing-library/react';import Form from '@/components/operations/AdsBindingForm';
const id='b0000000-0000-4000-8000-000000000001',org='c0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function view(action:'bind'|'access'='bind'){render(<Form locale="zh" action={action} accountId="adacct_fictional" company={org} month="2026-10" button="提交"><input name="action" type="hidden" value={action}/><input name="bindingId" type="hidden" value={id}/><input name="snapshotId" type="hidden" value={id}/><input name="organizationId" type="hidden" value={org}/><input name="active" type="hidden" value="no"/><input name="note" aria-label="依据" defaultValue="FICTIONAL ownership evidence"/></Form>);}
const submit=()=>fireEvent.submit(screen.getByRole('button').closest('form')!);
it('confirms original ownership or internal access while explicitly separating real advertising and client permissions',async()=>{
 for(const action of ['bind','access'] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receipt:action==='bind'?{action,bindingId:id,organizationId:org,snapshotId:id}:{action,bindingId:id,active:false,revision:2}})));view(action);submit();const link=await screen.findByRole('link',{name:'查看原账户归属与交接状态'});expect(link.getAttribute('href')).toBe(`/zh/operations/ads-reporting?account=adacct_fictional&company=${org}&month=2026-10#source-handoff`);expect(screen.getByText(/不启动或暂停广告投放/)).toBeTruthy();cleanup();}
});
it('rejects a wrong company or opposite access receipt without a false success',async()=>{
 for(const [action,receipt] of [['bind',{action:'bind',bindingId:id,organizationId:id,snapshotId:id}],['access',{action:'access',bindingId:id,active:true,revision:2}]] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receipt})));view(action);submit();await screen.findByRole('alert');expect((screen.getByLabelText('依据') as HTMLInputElement).value).toBe('FICTIONAL ownership evidence');cleanup();}
});
it('retains the original request and evidence after timeout',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('timeout')))));vi.stubGlobal('fetch',fetcher);view();submit();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('依据') as HTMLInputElement).value).toBe('FICTIONAL ownership evidence');
});
