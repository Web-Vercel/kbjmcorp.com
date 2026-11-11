// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,act,waitFor} from '@testing-library/react';
const nav=vi.hoisted(()=>({refresh:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>nav}));
import Form from '@/components/collections/BankReceiptForm';
const id='b0000000-0000-4000-8000-000000000001',other='c0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
function children(mode:'prepare'|'review'){return <><input name="action" type="hidden" value={mode==='prepare'?'receipt':'review'}/><input name="bankReference" aria-label="流水号" defaultValue="FICTIONAL-BANK-REF"/>{mode==='review'&&<select name="decision" aria-label="复核结果"><option value="credited">入账</option><option value="rejected">拒绝</option></select>}</>;}
function view(mode:'prepare'|'review'='prepare'){return render(<Form locale="zh" mode={mode} company={id} month="2026-10" receiptId={mode==='review'?id:undefined} button="提交">{children(mode)}</Form>);}
const submit=()=>fireEvent.submit(screen.getByRole('button',{name:'提交'}).closest('form')!);
it('shows a prepared record with an exact scoped link but never claims it was credited',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receiptId:id,stage:'prepared'})));view();submit();await screen.findByText(/到账制单已保存/);expect(screen.getByText(/尚未入账/)).toBeTruthy();expect(screen.getByRole('link',{name:'定位原到账记录'}).getAttribute('href')).toBe(`/zh/operations/collections?company=${id}&month=2026-10#bank-receipt-${id}`);expect(nav.refresh).toHaveBeenCalledOnce();
});
it('confirms only the matching reviewed ID and submitted decision',async()=>{
 for(const result of [{ok:true},{ok:true,receiptId:other,stage:'credited'},{ok:true,receiptId:id,stage:'rejected'}]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(result)));view('review');submit();await screen.findByRole('alert');expect(nav.refresh).not.toHaveBeenCalled();cleanup();}
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receiptId:id,stage:'credited'})));view('review');submit();await screen.findByText(/系统已完成余额入账/);expect(nav.refresh).toHaveBeenCalledOnce();expect(screen.queryByRole('button',{name:'提交'})).toBeNull();
});
it('retains the confirmation across server refresh, and hides a closed record form on a fresh load',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receiptId:id,stage:'credited'})));const ui=view('review');submit();await screen.findByText(/系统已完成余额入账/);ui.rerender(<Form locale="zh" mode="review" currentStatus="credited" receiptId={id} button="提交">{children('review')}</Form>);expect(screen.getByText(/系统已完成余额入账/)).toBeTruthy();cleanup();render(<Form locale="zh" mode="review" currentStatus="credited" receiptId={id} button="提交">{children('review')}</Form>);expect(screen.queryByRole('button')).toBeNull();
});
it('bounds uncertain operations, locks repeated submits and preserves bank reference without auto retry',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn((_u,o)=>new Promise((_r,j)=>o.signal.addEventListener('abort',()=>j(new Error('PRIVATE')))));vi.stubGlobal('fetch',fetcher);view();submit();fireEvent.submit(screen.getByRole('button',{name:'正在保存…'}).closest('form')!);await act(async()=>vi.advanceTimersByTimeAsync(30000));expect(fetcher).toHaveBeenCalledOnce();expect(screen.getByRole('alert').textContent).toContain('不能认定未保存或未入账');expect((screen.getByLabelText('流水号') as HTMLInputElement).value).toBe('FICTIONAL-BANK-REF');expect(nav.refresh).not.toHaveBeenCalled();
});
it('reports duplicate, conflict and access failures without claiming success or discarding evidence',async()=>{
 for(const [status,error,text] of [[409,'duplicate_reference','不要改流水号'],[409,'conflict','状态已变化'],[403,'forbidden','独立复核条件'],[401,'unauthenticated','登录已过期']] as const){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error},{status})));view();submit();await waitFor(()=>expect(screen.getByRole('status').textContent).toContain(text));expect((screen.getByLabelText('流水号') as HTMLInputElement).value).toBe('FICTIONAL-BANK-REF');expect(nav.refresh).not.toHaveBeenCalled();cleanup();}
});
it('labels fictional acceptance and a rejected review without claiming a real receipt',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,receiptId:id,stage:'rejected'})));render(<Form locale="zh" mode="review" receiptId={id} fictional button="提交">{children('review')}</Form>);fireEvent.change(screen.getByLabelText('复核结果'),{target:{value:'rejected'}});submit();await screen.findByText(/拒绝复核结果已保存/);expect(screen.getByText(/不代表实际收款/)).toBeTruthy();
});
