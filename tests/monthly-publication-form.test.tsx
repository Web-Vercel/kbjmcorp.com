// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent,act} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({refresh:vi.fn(),push:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>m}));
import Form from '@/components/operations/MonthlyPublicationForm';
const id='b0000000-0000-4000-8000-000000000001',receipt='b0000000-0000-4000-8000-000000000002';
const preview={wallet_open:true,balance_minor:'60000',charge_minor:'40000',remaining_minor:'20000'};
function mount(){render(<Form locale="zh" draftId={id} company={id} month="2024-01" amountMinor="40000" preview={preview}/>);}
function fill(){fireEvent.change(screen.getByRole('textbox'),{target:{value:'虚构案例：原收费约定已核实'}});fireEvent.click(screen.getByRole('checkbox'));}
const submit=()=>fireEvent.submit(screen.getByRole('textbox').closest('form')!);
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
it('previews without writing and only shows publication after a validated receipt, suppressing repeated submission',async()=>{
 let resolve!:(value:Response)=>void;const fetch=vi.fn((_url:string,_init:RequestInit)=>new Promise<Response>(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);mount();expect(fetch).not.toHaveBeenCalled();expect(screen.getByText('CNY 600.00')).toBeTruthy();expect(screen.getByText('CNY 200.00')).toBeTruthy();fill();submit();submit();expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({draftId:id,summary:'虚构案例：原收费约定已核实',confirm:'on'});
 await act(async()=>resolve(Response.json({ok:true,id:receipt})));expect(screen.getByRole('status').textContent).toContain(receipt);expect(screen.queryByRole('textbox')).toBeNull();expect(m.refresh).toHaveBeenCalledTimes(1);
});
it('retains original input on insufficient funds and refreshes without sending another financial request',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({error:'insufficient_balance'},{status:400}));vi.stubGlobal('fetch',fetch);mount();fill();await act(async()=>submit());expect(screen.getByRole('status').textContent).toContain('本次未发布、未扣款');expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain('原收费约定');fireEvent.click(screen.getByRole('button',{name:'刷新核查发布与余额'}));expect(m.refresh).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledTimes(1);
});
it('ends unknown waiting after 30 seconds and keeps the same draft and summary on an explicit retry',async()=>{
 vi.useFakeTimers();const fetch=vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')))));vi.stubGlobal('fetch',fetch);mount();fill();submit();await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});expect(screen.getByRole('status').textContent).toContain('发布结果未知');expect((screen.getByRole('button',{name:'正式发布并扣余额 CNY 400.00'}) as HTMLButtonElement).disabled).toBe(false);expect(m.refresh).not.toHaveBeenCalled();submit();expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
});
it('does not treat an HTTP 200 with missing or malformed receipt data as successful publication',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,id:'invalid'})));mount();fill();await act(async()=>submit());expect(screen.getByRole('status').textContent).toContain('发布结果未确认');expect(screen.getByRole('textbox')).toBeTruthy();expect(m.refresh).not.toHaveBeenCalled();
});
