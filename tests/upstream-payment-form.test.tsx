// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock('@/components/operations/SourceFingerprintField',()=>({default:()=> <input type="hidden" name="hash" value={'a'.repeat(64)}/>}));
import Form from '@/components/operations/UpstreamPaymentForm';
const id='b0000000-0000-4000-8000-000000000001';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup(){render(<Form locale="zh" organizationId={id} statements={[{id,account_name:'FICTIONAL',month:'2026-10-01',procurement_cad_minor:'10000',verified_cad_minor:'0',pending_cad_minor:'0'}]}/>);fireEvent.change(screen.getByLabelText('银行交易流水号（逐笔唯一）'),{target:{value:'FICTIONAL-001'}});fireEvent.change(screen.getByLabelText('加拿大实际到账日期'),{target:{value:'2026-10-31'}});fireEvent.change(screen.getByLabelText('本笔加拿大净到账 CAD'),{target:{value:'20.00'}});fireEvent.change(screen.getByLabelText('原件保管位置／核实参考号'),{target:{value:'FICTIONAL ARCHIVE'}});fireEvent.change(screen.getByLabelText('核对说明'),{target:{value:'FICTIONAL CHECK'}});fireEvent.change(screen.getByLabelText('第 1 项账单'),{target:{value:id}});fireEvent.change(screen.getByLabelText('第 1 项核销金额 CAD'),{target:{value:'20.00'}});fireEvent.click(screen.getByRole('checkbox'));}
it('rejects unbalanced allocations before sending',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);setup();fireEvent.change(screen.getByLabelText('第 1 项核销金额 CAD'),{target:{value:'19'}});await userEvent.setup().click(screen.getByRole('button',{name:'提交独立复核'}));expect(screen.getByRole('status').textContent).toContain('合计必须等于');expect(fetch).not.toHaveBeenCalled();});
it('retains the same request ID after an unknown network outcome',async()=>{const fetch=vi.fn().mockRejectedValueOnce(Error('network')).mockResolvedValueOnce(Response.json({ok:true,id,receipt:{id,action:'submit',stage:'registered',organizationId:id}}));vi.stubGlobal('fetch',fetch);setup();const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'提交独立复核'}));expect(screen.getByRole('status').textContent).toContain('保存结果未知');await user.click(screen.getByRole('button',{name:'提交独立复核'}));expect(JSON.parse(fetch.mock.calls[0][1].body).requestId).toBe(JSON.parse(fetch.mock.calls[1][1].body).requestId);expect(screen.getByRole('status').textContent).toContain('已确认 CAD 到账与分配登记记录');});
it('preserves the original bank reference and allocation on a malformed success or server error',async()=>{
 for(const response of [Response.json({ok:true,id}),Response.json({error:'unavailable'},{status:503})]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));setup();await userEvent.setup().click(screen.getByRole('button',{name:'提交独立复核'}));expect(screen.getByRole('alert').textContent).toContain('登记结果未知');expect((screen.getByLabelText('银行交易流水号（逐笔唯一）') as HTMLInputElement).value).toBe('FICTIONAL-001');expect((screen.getByLabelText('第 1 项核销金额 CAD') as HTMLInputElement).value).toBe('20.00');cleanup();}
});
it('prefills a single fictional allocation and never asks the tester to attest actual payment',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 render(<Form locale="zh" organizationId={id} testMode statements={[{id,account_name:'FICTIONAL',month:'2026-10-01',procurement_cad_minor:'4530',verified_cad_minor:'0',pending_cad_minor:'0'}]}/>);
 expect((screen.getByLabelText('测试金额 CAD') as HTMLInputElement).value).toBe('45.30');expect((screen.getByLabelText('第 1 项账单') as HTMLSelectElement).value).toBe(id);
 expect(screen.getByRole('checkbox').parentElement?.textContent).toContain('未实际汇款');expect(screen.queryByText(/已核实实际 CAD/)).toBeNull();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('button',{name:'提交独立复核'}).closest('form')!);
 expect(screen.getAllByRole('status').some(n=>n.textContent?.includes('请先生成测试凭证'))).toBe(true);expect(fetch).not.toHaveBeenCalled();
});
it('generates the matching fictional PDF and invalidates its fingerprint when the amount changes',async()=>{
 const {webcrypto}=await import('node:crypto');vi.stubGlobal('crypto',webcrypto);
 const NativeURL=URL;vi.stubGlobal('URL',class extends NativeURL {static createObjectURL=vi.fn(()=> 'blob:fictional');static revokeObjectURL=vi.fn();});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 try{
  render(<Form locale="zh" organizationId={id} testMode statements={[{id,account_name:'FICTIONAL',month:'2026-10-01',procurement_cad_minor:'4530',verified_cad_minor:'0',pending_cad_minor:'0'}]}/>);
  const button=screen.getByRole('button',{name:'生成测试凭证 PDF'});await userEvent.setup().click(button);
  await vi.waitFor(()=>expect(screen.getAllByRole('status').some(n=>n.textContent?.includes('测试凭证与指纹已生成'))).toBe(true));
  const form=button.closest('form')!;expect((form.elements.namedItem('bankReference') as HTMLInputElement).value).toMatch(/^TEST-UPSTREAM-/);expect((form.elements.namedItem('hash') as HTMLInputElement).value).toMatch(/^[a-f0-9]{64}$/);expect(click).toHaveBeenCalledOnce();
  fireEvent.input(screen.getByLabelText('测试金额 CAD'),{target:{value:'40.00'}});expect((form.elements.namedItem('hash') as HTMLInputElement).value).toBe('');
 }finally{click.mockRestore();}
});
it('retains a reversed receipt reference/date/amount for a new revision, regenerates matching evidence and clears it when switching modes',async()=>{
 const {webcrypto,createHash}=await import('node:crypto');const {upstreamTestPdf}=await import('@/lib/billing/upstream-test-fixture');vi.stubGlobal('crypto',webcrypto);
 const NativeURL=URL;vi.stubGlobal('URL',class extends NativeURL {static createObjectURL=vi.fn(()=> 'blob:fictional');static revokeObjectURL=vi.fn();});const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 try{const reference='TEST-UPSTREAM-ORIGINAL-4530';render(<Form locale="zh" organizationId={id} testMode statements={[{id,account_name:'FICTIONAL',month:'2026-10-01',procurement_cad_minor:'4530',verified_cad_minor:'0',pending_cad_minor:'0'}]} corrections={[{id,bank_reference:reference,received_on:'2026-11-16',received_cad_minor:'4530',revision:1}]}/>);
 fireEvent.change(screen.getByLabelText('登记方式'),{target:{value:id}});expect((screen.getByLabelText('沿用原测试流水号') as HTMLInputElement).value).toBe(reference);expect((screen.getByLabelText('模拟到账日期') as HTMLInputElement).value).toBe('2026-11-16');expect((screen.getByLabelText('测试金额 CAD') as HTMLInputElement).value).toBe('45.30');
 const button=screen.getByRole('button',{name:'生成测试凭证 PDF'});await userEvent.setup().click(button);const form=button.closest('form')!;await vi.waitFor(()=>expect((form.elements.namedItem('hash') as HTMLInputElement).value).toBe(createHash('sha256').update(upstreamTestPdf(reference,'2026-11-16','45.30')).digest('hex')));
 fireEvent.change(screen.getByLabelText('登记方式'),{target:{value:''}});expect((form.elements.namedItem('bankReference') as HTMLInputElement).value).toBe('');expect((form.elements.namedItem('hash') as HTMLInputElement).value).toBe('');
 }finally{click.mockRestore();}
});
