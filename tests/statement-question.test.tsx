// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({refresh:vi.fn(),push:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>m}));
import Question from '@/components/billing/StatementQuestion';
const id='b0000000-0000-4000-8000-000000000001',ticket='b0000000-0000-4000-8000-000000000002';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
function fill(){fireEvent.change(screen.getByLabelText('问题标题'),{target:{value:'FICTIONAL QUESTION'}});fireEvent.change(screen.getByLabelText('具体说明'),{target:{value:'Please explain this fictional bill.'}});}
it('submits only on request, prevents double clicks and links the confirmed ticket',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({ok:true,requestId:ticket}));vi.stubGlobal('fetch',fetch);render(<Question statementId={id} locale="zh"/>);expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByText('对此账单有疑问？'));fill();await userEvent.click(screen.getByRole('button'));expect(fetch).toHaveBeenCalledTimes(1);expect(screen.getByRole('link',{name:'打开工单'}).getAttribute('href')).toContain(ticket);expect(m.refresh).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button')).toBeNull();
});
it('bounds an unknown request at 30 seconds and retains the idempotency key on unchanged retry',async()=>{
 vi.useFakeTimers();const fetch=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')))));vi.stubGlobal('fetch',fetch);render(<Question statementId={id} locale="zh"/>);fireEvent.click(screen.getByText('对此账单有疑问？'));fill();const form=screen.getByRole('button').closest('form')!;fireEvent.submit(form);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(screen.getByRole('status').textContent).toContain('提交结果未知');expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);fireEvent.submit(form);expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 fireEvent.change(screen.getByLabelText('问题标题'),{target:{value:'A DIFFERENT QUESTION'}});fireEvent.submit(form);expect(JSON.parse(fetch.mock.calls[2][1].body).requestId).not.toBe(JSON.parse(fetch.mock.calls[0][1].body).requestId);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
});

it('returns an expired question submission to the original bill, not a new ticket',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'unauthenticated'},{status:401}));vi.stubGlobal('fetch',fetcher);render(<Question statementId={id} locale="zh"/>);fireEvent.click(screen.getByText('对此账单有疑问？'));fill();fireEvent.submit(screen.getByRole('button').closest('form')!);const target=`/zh/account/statements?statement=${id}#statement-${id}`;await waitFor(()=>expect(m.push).toHaveBeenCalledWith(`/zh/login?${new URLSearchParams({returnTo:target})}`));expect(m.refresh).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.queryByRole('link',{name:'打开工单'})).toBeNull();
});
