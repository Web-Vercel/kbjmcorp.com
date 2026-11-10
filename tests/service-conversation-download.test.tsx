// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,act} from '@testing-library/react';
import Download from '@/components/operations/ServiceConversationDownload';
const id='b0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it('requests a fresh authorized CSV and triggers a named download without business writes',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response('FICTIONAL CSV',{headers:{'content-type':'text/csv; charset=utf-8'}}));vi.stubGlobal('fetch',fetcher);
 const create=vi.fn(()=> 'blob:fictional'),revoke=vi.fn();vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:revoke}));
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe(`service-${id}.csv`);expect(this.href).toBe('blob:fictional');});
 render(<Download locale="zh" requestId={id}/>);expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button'));await screen.findByText(/已请求浏览器下载/);
 expect(fetcher).toHaveBeenCalledWith(`/api/service/${id}/export?locale=zh`,expect.objectContaining({cache:'no-store'}));expect(click).toHaveBeenCalledOnce();expect(create).toHaveBeenCalledOnce();
});
it('reports expired login, revoked access and concurrent changes without claiming a download',async()=>{
 for(const [status,text] of [[401,'登录已过期'],[404,'无法访问'],[409,'刚有更新'],[502,'无法生成完整记录']] as const){const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status}));vi.stubGlobal('fetch',fetcher);render(<Download locale="zh" requestId={id}/>);fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect(screen.queryByText(/已请求浏览器下载/)).toBeNull();cleanup();}
});
it('times out at 30 seconds, blocks repeated clicks and never auto retries',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('timeout')))));vi.stubGlobal('fetch',fetcher);render(<Download locale="en" requestId={id}/>);fireEvent.click(screen.getByRole('button'));fireEvent.click(screen.getByRole('button'));await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('status').textContent).toContain('Download did not complete');expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
});
