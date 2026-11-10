// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent,act} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
const refresh=vi.hoisted(()=>vi.fn());vi.mock('next/navigation',()=>({useRouter:()=>({refresh,push:vi.fn()})}));
import AdminForm from '@/components/admin/AdminForm';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});
it('bounds reversal waiting, preserves evidence and reuses the same request after an unknown outcome',async()=>{
 vi.useFakeTimers();const fetch=vi.fn().mockImplementationOnce((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))).mockResolvedValueOnce(Response.json({ok:true}));vi.stubGlobal('fetch',fetch);
 render(<AdminForm locale="zh" endpoint="/api/upstream-payments" timeoutMs={30000} button="提交撤销"><input name="action" type="hidden" value="reversal_submit"/><input name="requestId" type="hidden" value="c0000000-0000-4000-8000-000000000001"/><label>撤销原因<textarea name="reason" defaultValue="Verified correction evidence"/></label></AdminForm>);
 fireEvent.submit(screen.getByRole('button').closest('form')!);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(screen.getByRole('status').textContent).toContain('保存结果未知');expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);expect((screen.getByLabelText('撤销原因') as HTMLTextAreaElement).value).toBe('Verified correction evidence');expect(refresh).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.submit(screen.getByRole('button').closest('form')!);});expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);expect(refresh).toHaveBeenCalledTimes(1);
});
