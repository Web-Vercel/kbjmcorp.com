// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
const nav=vi.hoisted(()=>({refresh:vi.fn(),push:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>nav}));
import Form from '@/components/operations/ServiceReplyForm';
const id='b0000000-0000-4000-8000-000000000001',msg='c0000000-0000-4000-8000-000000000001';const receipt={message_id:msg,request_id:id,status:'open',created_at:'2026-11-10T00:00:00Z',replayed:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
function view(staff=false){render(<Form locale="zh" requestId={id} staff={staff}/>);fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL reply body'}});}
function submit(){fireEvent.submit(screen.getByRole('button',{name:'发送回复'}).closest('form')!);}
it('shows a validated message receipt and locates the exact saved reply',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,receipt}));vi.stubGlobal('fetch',fetcher);view();expect(fetcher).not.toHaveBeenCalled();submit();await screen.findByText(/回复已保存/);expect(screen.getByRole('link',{name:'定位此条回复'}).getAttribute('href')).toBe(`#service-message-${msg}`);expect(nav.refresh).toHaveBeenCalledTimes(1);expect(screen.queryByRole('checkbox')).toBeNull();
});
it('blocks duplicate clicks and reuses the same key after an unknown result',async()=>{
 let reject!:(e:Error)=>void;const fetcher=vi.fn().mockImplementationOnce(()=>new Promise((_r,j)=>{reject=j;})).mockResolvedValue(Response.json({ok:true,receipt:{...receipt,replayed:true}}));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button',{name:'正在发送…'}).closest('form')!);expect(fetcher).toHaveBeenCalledTimes(1);await act(async()=>reject(new Error('PRIVATE NETWORK')));expect(screen.getByRole('alert').textContent).toContain('回复结果未知');expect((screen.getByLabelText('回复内容') as HTMLTextAreaElement).value).toBe('FICTIONAL reply body');submit();await screen.findByText(/已核对到原回复，未重复发送/);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);expect(screen.queryByText(/PRIVATE NETWORK/)).toBeNull();
});
it('bounds a pending reply at 30 seconds and does not auto-retry',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,options)=>new Promise((_r,j)=>options.signal.addEventListener('abort',()=>j(new Error('timeout')))));vi.stubGlobal('fetch',fetcher);view();submit();await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(screen.getByRole('alert').textContent).toContain('回复结果未知');expect(fetcher).toHaveBeenCalledTimes(1);expect((screen.getByRole('button',{name:'发送回复'}) as HTMLButtonElement).disabled).toBe(false);expect(nav.refresh).not.toHaveBeenCalled();
});
it('never claims success for a wrong-thread receipt or a legacy success without receipt',async()=>{
 for(const data of [{ok:true},{ok:true,receipt:{...receipt,request_id:msg}}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(data)));view();submit();await screen.findByRole('alert');expect(screen.queryByText(/回复已保存/)).toBeNull();expect(nav.refresh).not.toHaveBeenCalled();cleanup();}
});
it('explains a missing update with no unprotected fallback and no client-facing SQL details',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'reply_update_required'},{status:503}));vi.stubGlobal('fetch',fetcher);view();submit();await screen.findByText(/回复功能暂不可用/);expect(screen.queryByText(/037/)).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);expect(nav.refresh).not.toHaveBeenCalled();
});
it('allows a new explicit reply after a confirmed receipt and generates a new key',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,receipt}));vi.stubGlobal('fetch',fetcher);view(true);fireEvent.change(screen.getByLabelText('处理状态'),{target:{value:'resolved'}});submit();await screen.findByText(/回复已保存/);fireEvent.click(screen.getByRole('button',{name:'继续填写下一条回复'}));fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL another reply'}});submit();await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));expect(JSON.parse(fetcher.mock.calls[0][1].body).replyKey).not.toBe(JSON.parse(fetcher.mock.calls[1][1].body).replyKey);
});

it('does not carry a confirmed reply or its request key into another selected thread',async()=>{
 const {default:Thread}=await import('@/components/operations/ServiceThread');const row={id,organization_id:id,category:'billing',subject:'FICTIONAL request',status:'open',created_at:receipt.created_at,updated_at:receipt.created_at};
 const fetcher=vi.fn().mockImplementation(async(_u,options)=>Response.json({ok:true,receipt:{...receipt,request_id:JSON.parse(options.body).requestId}}));vi.stubGlobal('fetch',fetcher);const view=render(<Thread locale="zh" requests={[row]} selected={row} messages={[]}/>);fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL reply body'}});submit();await screen.findByText(/回复已保存/);
 const other={...row,id:msg};view.rerender(<Thread locale="zh" requests={[other]} selected={other} messages={[]}/>);expect(screen.queryByText(/回复已保存/)).toBeNull();expect((screen.getByLabelText('回复内容') as HTMLTextAreaElement).value).toBe('');fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL reply body'}});submit();await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));expect(JSON.parse(fetcher.mock.calls[0][1].body).replyKey).not.toBe(JSON.parse(fetcher.mock.calls[1][1].body).replyKey);
});
