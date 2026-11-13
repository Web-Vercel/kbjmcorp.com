// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>m}));
import Login from '@/components/demo/DemoLogin';
beforeEach(()=>vi.clearAllMocks());afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function mount(){render(<Login locale="zh" enabled/>);fireEvent.change(screen.getByLabelText('演示账号'),{target:{value:'client-demo'}});fireEvent.change(screen.getByLabelText('密码'),{target:{value:'FICTIONAL PASSWORD'}});}
it('prevents repeated submissions and navigates only to the demo workspace after confirmation',async()=>{
 let resolve!:(r:Response)=>void;const fetcher=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(r=>{resolve=r}));vi.stubGlobal('fetch',fetcher);mount();const form=screen.getByRole('button',{name:'进入演示中心'}).closest('form')!;fireEvent.submit(form);fireEvent.submit(form);expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({username:'client-demo',password:'FICTIONAL PASSWORD'});await act(async()=>resolve(Response.json({ok:true})));expect(m.replace).toHaveBeenCalledWith('/zh/demo');expect(m.refresh).toHaveBeenCalledTimes(1);expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');
});
it('ends timeout without automatic resubmission and clears the password',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('PRIVATE')))));vi.stubGlobal('fetch',fetcher);mount();fireEvent.submit(screen.getByRole('button',{name:'进入演示中心'}).closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(20000));expect(screen.getByRole('status').textContent).toContain('连接未完成');expect(fetcher).toHaveBeenCalledTimes(1);expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');expect(m.replace).not.toHaveBeenCalled();expect(screen.queryByText('PRIVATE')).toBeNull();
});
