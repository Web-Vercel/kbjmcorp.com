// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
const refresh=vi.hoisted(()=>vi.fn());const push=vi.hoisted(()=>vi.fn());vi.mock('next/navigation',()=>({useRouter:()=>({refresh,push})}));
import Confirmation from '@/components/billing/StatementReadConfirmation';
const id='b0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
it('does not acknowledge automatically and shows success only after a valid server receipt',async()=>{const fetch=vi.fn().mockResolvedValue(Response.json({ok:true,receipt:{statement_id:id,confirmed_at:'2026-11-01T00:00:00Z'}}));vi.stubGlobal('fetch',fetch);render(<Confirmation statementId={id} confirmedAt={null} available locale="zh"/>);expect(fetch).not.toHaveBeenCalled();const user=userEvent.setup();await user.click(screen.getByRole('button'));expect(fetch).not.toHaveBeenCalled();await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button'));expect(screen.getByRole('status').textContent).toContain('您已确认查阅');expect(refresh).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button')).toBeNull();});
it('keeps viewing available when reading-receipt lookup is unavailable',()=>{render(<Confirmation statementId={id} confirmedAt={null} available={false} locale="zh"/>);expect(screen.getByText(/仍可查看和下载账单/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();});
it('ends unknown waiting after 30 seconds and allows an idempotent retry',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))));render(<Confirmation statementId={id} confirmedAt={null} available locale="zh"/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('button').closest('form')!);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(screen.getByRole('status').textContent).toContain('保存结果未知');expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);expect(refresh).not.toHaveBeenCalled();});

it('returns an expired reading-confirmation session to the original statement without auto-confirming',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'unauthenticated'},{status:401}));vi.stubGlobal('fetch',fetcher);render(<Confirmation statementId={id} confirmedAt={null} available locale="zh"/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('button').closest('form')!);const target=`/zh/account/statements?statement=${id}#statement-${id}`;await waitFor(()=>expect(push).toHaveBeenCalledWith(`/zh/login?${new URLSearchParams({returnTo:target})}`));expect(refresh).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);
});
