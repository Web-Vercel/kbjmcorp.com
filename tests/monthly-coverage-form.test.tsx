// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
import Form from '@/components/operations/MonthlyCoverageForm';
const source='b0000000-0000-4000-8000-000000000001',check='c0000000-0000-4000-8000-000000000001',other='d0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
const fields=(mode:'submit'|'review')=><><input name="action" type="hidden" value={mode}/><input name="snapshotId" type="hidden" value={source}/><input name="requestId" type="hidden" value={other}/><input name="checkId" type="hidden" value={check}/><input name="evidence" aria-label="依据" defaultValue="FICTIONAL EVIDENCE"/>{mode==='review'&&<select name="decision" aria-label="决定"><option value="approved">通过</option><option value="rejected">退回</option></select>}</>;
function view(mode:'submit'|'review'='submit'){render(<Form locale="zh" mode={mode} snapshotId={source} checkId={mode==='review'?check:undefined} company={other} month="2026-10" button="提交">{fields(mode)}</Form>);}
const submit=()=>fireEvent.submit(screen.getByRole('button').closest('form')!);
it('confirms the evidence ID and exact source without inferring pending or approved current status',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,checkId:check,snapshotId:source,stage:'submitted'})));view();submit();await screen.findByText(/已确认整月核实依据记录/);expect(screen.getByText(/当前状态请查看原记录/)).toBeTruthy();expect(screen.getByRole('link',{name:'查看原核实及复核记录'}).getAttribute('href')).toBe(`/zh/operations/source-checks?company=${other}&month=2026-10#coverage-check-${check}`);expect(screen.queryByRole('button')).toBeNull();
});
it('only confirms the submitted review decision for the exact evidence record',async()=>{
 for(const data of [{ok:true},{ok:true,checkId:other,stage:'approved'},{ok:true,checkId:check,stage:'rejected'}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(data)));view('review');submit();await screen.findByRole('alert');expect(screen.queryByText(/已保存通过复核的结果/)).toBeNull();cleanup();}
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,checkId:check,stage:'approved'})));view('review');submit();await screen.findByText(/已保存通过复核的结果/);expect(screen.getByText(/是否具备制单条件仍以最新来源/)).toBeTruthy();
});
it('rejects an evidence receipt for a different source snapshot',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,checkId:check,snapshotId:other,stage:'submitted'})));view();submit();await screen.findByRole('alert');expect((screen.getByLabelText('依据') as HTMLInputElement).value).toBe('FICTIONAL EVIDENCE');
});
it('times out, retains the same request and evidence, and blocks automatic or concurrent retries',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE'))))).mockResolvedValue(Response.json({ok:true,checkId:check,snapshotId:source,stage:'submitted'}));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button').closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存');expect((screen.getByLabelText('依据') as HTMLInputElement).value).toBe('FICTIONAL EVIDENCE');await act(async()=>submit());expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
it('keeps discrepancies, access denial and conflicts explicit while preserving evidence',async()=>{
 for(const [error,status,text] of [['coverage_difference',400,'不能用人工通过覆盖差额'],['forbidden',403,'独立复核'],['conflict',409,'不要重复新建']] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();submit();await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect((screen.getByLabelText('依据') as HTMLInputElement).value).toBe('FICTIONAL EVIDENCE');cleanup();}
});
it('labels a rejection as evidence recheck without implying a published bill or debit',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,checkId:check,stage:'rejected'})));view('review');fireEvent.change(screen.getByLabelText('决定'),{target:{value:'rejected'}});submit();await screen.findByText(/退回核实结果已保存/);expect(screen.getByText(/不发布客户账单、不扣余额/)).toBeTruthy();
});
