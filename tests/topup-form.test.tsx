// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
const nav=vi.hoisted(()=>({refresh:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>nav}));
import Form from '@/components/billing/TopupForm';
const wallet='b0000000-0000-4000-8000-000000000001',notice='c0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
function view(){render(<Form locale="zh" walletId={wallet} currency="CNY"/>);fireEvent.change(screen.getByLabelText('充值金额（CNY）'),{target:{value:'1000.01'}});fireEvent.change(screen.getByLabelText('付款参考号'),{target:{value:'FICTIONAL-REF'}});fireEvent.click(screen.getByRole('checkbox'));}
const submit=()=>fireEvent.submit(screen.getByRole('button',{name:'提交充值核对'}).closest('form')!);
it('confirms only a valid notice ID, exact amount and pending receipt with a record anchor',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,status:'pending',noticeId:notice}));vi.stubGlobal('fetch',fetcher);view();submit();await screen.findByText(/付款通知已保存/);expect(screen.getByText(/CNY 1,000.01/)).toBeTruthy();expect(screen.getByRole('link',{name:'定位原付款通知'}).getAttribute('href')).toBe(`#topup-${notice}`);expect(screen.getByText(/这不是到账回执/)).toBeTruthy();expect(nav.refresh).toHaveBeenCalledOnce();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({amount:'1000.01',reference:'FICTIONAL-REF',confirm:'on',walletId:wallet});
});
it('bounds uncertain submissions and preserves inputs, without an automatic retry',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE timeout')))));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button',{name:'提交中…'}).closest('form')!);expect(fetcher).toHaveBeenCalledOnce();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('付款参考号') as HTMLInputElement).value).toBe('FICTIONAL-REF');expect((screen.getByLabelText('充值金额（CNY）') as HTMLInputElement).value).toBe('1000.01');expect(nav.refresh).not.toHaveBeenCalled();expect(screen.queryByText(/PRIVATE/)).toBeNull();
});
it('does not trust a legacy or malformed success, a credited status or server failure',async()=>{
 for(const data of [{ok:true,status:'pending'},{ok:true,status:'credited',noticeId:notice},{ok:true,status:'pending',noticeId:'bad'}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(data)));view();submit();await screen.findByRole('alert');expect(screen.queryByText(/付款通知已保存/)).toBeNull();expect(nav.refresh).not.toHaveBeenCalled();cleanup();}
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'unavailable'},{status:503})));view();submit();await screen.findByRole('alert');expect((screen.getByLabelText('付款参考号') as HTMLInputElement).value).toBe('FICTIONAL-REF');
});
it('explains duplicate references, expired sessions and revoked permissions without discarding the original notice input',async()=>{
 for(const [status,error,text] of [[409,'duplicate_reference','不要更换参考号'],[401,'unauthenticated','登录已过期'],[403,'forbidden','财务权限']] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();submit();await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect((screen.getByLabelText('付款参考号') as HTMLInputElement).value).toBe('FICTIONAL-REF');expect(nav.refresh).not.toHaveBeenCalled();cleanup();}
});
it('permits another notice only through an explicit new-payment action after receipt',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,status:'pending',noticeId:notice}));vi.stubGlobal('fetch',fetcher);view();submit();await screen.findByText(/付款通知已保存/);expect(screen.queryByLabelText('付款参考号')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'登记另一笔实际付款通知'}));expect((screen.getByLabelText('付款参考号') as HTMLInputElement).value).toBe('');expect(fetcher).toHaveBeenCalledOnce();
});
