// @vitest-environment jsdom
import {webcrypto} from 'node:crypto';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import SourceFingerprintField,{pdfFingerprint,MAX_SOURCE_BYTES} from '@/components/operations/SourceFingerprintField';
import {opsSchema} from '@/lib/operations/model';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function pdf(text='%PDF-1.7\nFICTIONAL SOURCE'){const bytes=new TextEncoder().encode(text);const f=new File([bytes],'source.pdf',{type:'application/pdf'});Object.defineProperty(f,'arrayBuffer',{value:async()=>bytes.buffer});return f;}
it('computes a stable SHA-256 from exact bytes and rejects non-PDF and oversized input',async()=>{vi.stubGlobal('crypto',webcrypto);const first=await pdfFingerprint(pdf());expect(first).toMatch(/^[a-f0-9]{64}$/);expect(await pdfFingerprint(pdf())).toBe(first);expect(await pdfFingerprint(pdf('%PDF-1.7\nCHANGED'))).not.toBe(first);await expect(pdfFingerprint(pdf('not a PDF'))).rejects.toThrow('pdf');const huge=pdf();Object.defineProperty(huge,'size',{value:MAX_SOURCE_BYTES+1});await expect(pdfFingerprint(huge)).rejects.toThrow('size');});
it('never uploads file content and clears the generated hash on form reset',async()=>{vi.stubGlobal('crypto',webcrypto);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<form data-testid="form"><SourceFingerprintField locale="zh"/><button type="reset">重置</button></form>);const user=userEvent.setup();await user.upload(screen.getByLabelText('选择原始 PDF（最大25MB）'),pdf());await waitFor(()=>expect((screen.getByLabelText('原件SHA-256（选填，仅登记）') as HTMLInputElement).value).toMatch(/^[a-f0-9]{64}$/));const data=new FormData(screen.getByTestId('form') as HTMLFormElement);expect([...data.keys()]).toEqual(['hash']);expect(fetch).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'重置'}));expect((screen.getByLabelText('原件SHA-256（选填，仅登记）') as HTMLInputElement).value).toBe('');});
it('normalizes a report month but still rejects a non-first-day legacy date',()=>{const data={action:'source',organizationId:'a0000000-0000-4000-8000-000000000001',accountId:'b0000000-0000-4000-8000-000000000001',period:'2026-11',currency:'CAD',timezone:'UTC',language:'en',amount:'1000.01',reference:'FICTIONAL report',hash:'',confirm:'on'};const result=opsSchema.parse(data);expect('period'in result&&result.period).toBe('2026-11-01');expect(opsSchema.safeParse({...data,period:'2026-11-06'}).success).toBe(false);});

it('hashes required CSV evidence locally without uploading its contents',async()=>{
 vi.stubGlobal('crypto',webcrypto);const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const bytes=new TextEncoder().encode('date,spend\n2026-01-01,0');const file=new File([bytes],'monthly.csv',{type:'text/csv'});Object.defineProperty(file,'arrayBuffer',{value:async()=>bytes.buffer});render(<form><SourceFingerprintField locale="zh" required allowCsv/></form>);
 await userEvent.setup().upload(screen.getByLabelText('选择核实文件（最大25MB）'),file);await waitFor(()=>expect((screen.getByLabelText('原件 SHA-256（必填）') as HTMLInputElement).value).toMatch(/^[a-f0-9]{64}$/));expect((screen.getByLabelText('原件 SHA-256（必填）') as HTMLInputElement).required).toBe(true);expect(fetch).not.toHaveBeenCalled();
});
