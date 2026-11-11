// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import Form from '@/components/operations/QuoteArchiveForm';
const id='b0000000-0000-4000-8000-000000000001',other='c0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function view(archived=false){render(<Form locale="zh" quoteId={id} company={other} month="2026-10" archived={archived} revision={4}/>);fireEvent.change(screen.getByLabelText('操作说明'),{target:{value:'FICTIONAL archive reason'}});fireEvent.click(screen.getByRole('checkbox'));}
const submit=()=>fireEvent.submit(screen.getByRole('button').closest('form')!);
it('shows the original quote state receipt and exact archived-inclusive link without creating a new quote',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,receipt:{id,archived:true,stateRevision:5}}));vi.stubGlobal('fetch',fetcher);view();submit();await screen.findByText(/已确认原报价为归档状态/);expect(screen.getByText(/这不是新的报价版本/)).toBeTruthy();const link=screen.getByRole('link');expect(link.getAttribute('href')).toBe(`/zh/operations/pricing?company=${other}&month=2026-10&archived=yes#quote-${id}`);expect(link.getAttribute('target')).toBe('_blank');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({id,archived:'yes',revision:4,note:'FICTIONAL archive reason',confirm:'on'});expect(screen.queryByRole('button')).toBeNull();
});
it('confirms restoration and preserves the server revision on an already-achieved retry',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receipt:{id,archived:false,stateRevision:4}})));view(true);submit();await screen.findByText(/恢复为内部草稿/);expect(screen.getByText(/归档状态修订号/).textContent).toContain('4');
});
it('does not confirm a wrong quote, opposite target, invalid revision or old response',async()=>{
 for(const data of [{ok:true},{ok:true,receipt:{id:other,archived:true,stateRevision:5}},{ok:true,receipt:{id,archived:false,stateRevision:5}},{ok:true,receipt:{id,archived:true,stateRevision:-1}}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(data)));view();submit();await screen.findByRole('alert');expect(screen.queryByText(/已确认原报价为归档状态/)).toBeNull();expect((screen.getByLabelText('操作说明') as HTMLTextAreaElement).value).toBe('FICTIONAL archive reason');cleanup();}
});
it('bounds uncertainty, blocks duplicate clicks and retries the unchanged target and revision',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE'))))).mockResolvedValue(Response.json({ok:true,receipt:{id,archived:true,stateRevision:5}}));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button').closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('操作说明') as HTMLTextAreaElement).value).toBe('FICTIONAL archive reason');await act(async()=>submit());expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it('explains stale state or denied access and preserves the original reason',async()=>{
 for(const [status,error,text] of [[409,'conflict','已被更新'],[401,'unauthenticated','登录已过期'],[403,'forbidden','管理员身份']] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();submit();await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect((screen.getByLabelText('操作说明') as HTMLTextAreaElement).value).toBe('FICTIONAL archive reason');expect(screen.getByRole('link').getAttribute('href')).toContain('archived=yes');cleanup();}
});
