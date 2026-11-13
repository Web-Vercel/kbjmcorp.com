// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import Form from '@/components/operations/AdsSourceShareForm';
const binding='b0000000-0000-4000-8000-000000000001',snapshot='c0000000-0000-4000-8000-000000000001',handoff='d0000000-0000-4000-8000-000000000001';
const snap={id:snapshot,since:'2026-10-01',until:'2026-10-31',check_status:'coverage_pending'};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
function view(month:string|undefined='2026-10'){render(<Form locale="zh" bindingId={binding} company={binding} month={month} snapshots={[snap]}/>);}
function fill(){fireEvent.change(screen.getByLabelText('待交接的来源快照'),{target:{value:snapshot}});fireEvent.change(screen.getByLabelText('来源核对说明（财务可见）'),{target:{value:'FICTIONAL handoff note'}});fireEvent.click(screen.getByRole('checkbox'));}
const submit=()=>fireEvent.submit(screen.getByRole('button').closest('form')!);
it('requires an explicit version and confirmation before submitting any handoff',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);view();expect((screen.getByLabelText('待交接的来源快照') as HTMLSelectElement).value).toBe('');submit();expect(fetcher).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('请选择来源版本');
});
it('confirms exact source and handoff while preserving pending coverage semantics and scoped links',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,handoff:{id:handoff,bindingId:binding,snapshotId:snapshot}}));vi.stubGlobal('fetch',fetcher);view();fill();submit();await screen.findByText(/已确认选定来源的内部交接记录/);expect(screen.getByText(/不代表活动覆盖已核实/)).toBeTruthy();expect(screen.getByRole('link',{name:'查看此交接版本的财务来源记录'}).getAttribute('href')).toBe(`/zh/operations/source-data?company=${binding}&month=2026-10#source-handoff-${handoff}`);expect(screen.getByRole('link',{name:'进入本月活动覆盖核实'}).getAttribute('href')).toBe(`/zh/operations/source-checks?company=${binding}&month=2026-10#coverage-source-${snapshot}`);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({action:'share',bindingId:binding,snapshotId:snapshot,note:'FICTIONAL handoff note',confirm:'on'});expect(screen.queryByRole('button')).toBeNull();
});
it('rejects a wrong snapshot, wrong binding or missing receipt instead of declaring success',async()=>{
 for(const data of [{ok:true},{ok:true,handoff:{id:handoff,bindingId:handoff,snapshotId:snapshot}},{ok:true,handoff:{id:handoff,bindingId:binding,snapshotId:handoff}}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(data)));view();fill();submit();await screen.findByRole('alert');expect((screen.getByLabelText('待交接的来源快照') as HTMLSelectElement).value).toBe(snapshot);expect(screen.queryByText(/已确认选定来源的内部交接记录/)).toBeNull();cleanup();}
});
it('bounds a pending handoff and retries the same snapshot and note without an automatic retry',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE'))))).mockResolvedValue(Response.json({ok:true,handoff:{id:handoff,bindingId:binding,snapshotId:snapshot}}));vi.stubGlobal('fetch',fetcher);view();fill();submit();fireEvent.submit(screen.getByRole('button').closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('来源核对说明（财务可见）') as HTMLTextAreaElement).value).toBe('FICTIONAL handoff note');await act(async()=>submit());expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it('preserves evidence on role, conflict and session errors',async()=>{
 for(const [error,status,text] of [['forbidden',403,'账户访问已暂停'],['conflict',409,'已冻结的交接说明'],['unauthenticated',401,'登录已过期']] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();fill();submit();await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect((screen.getByLabelText('来源核对说明（财务可见）') as HTMLTextAreaElement).value).toBe('FICTIONAL handoff note');cleanup();}
});
it('keeps an operational-period handoff separate from monthly coverage navigation',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,handoff:{id:handoff,bindingId:binding,snapshotId:snapshot}})));
 render(<Form locale="zh" bindingId={binding} company={binding} snapshots={[{...snap,since:'2026-10-25'}]}/>);fill();submit();await screen.findByText(/已确认选定来源的内部交接记录/);expect(screen.queryByRole('link',{name:'进入本月活动覆盖核实'})).toBeNull();expect(screen.getByRole('link',{name:'查看此交接版本的财务来源记录'}).getAttribute('href')).toBe(`/zh/operations/source-data?company=${binding}#source-handoff-${handoff}`);
});
