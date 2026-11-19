// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Form from '@/components/admin/AdminForm';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps feedback and blocks resubmission when return readback is uncertain',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:'source_return_unconfirmed'})});vi.stubGlobal('fetch',fetch);
 render(<Form locale="zh" endpoint="/api/operations" reloadOnSuccess button="退回来源"><input name="action" value="return" readOnly/><label>原因<textarea name="reason" defaultValue="Missing daily records"/></label></Form>);
 const button=screen.getByRole('button',{name:'退回来源'});fireEvent.click(button);
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('退回结果尚未核实'));
 expect((button as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByLabelText('原因') as HTMLTextAreaElement).value).toBe('Missing daily records');
 expect(screen.getByRole('status').textContent).not.toContain('已保存');fireEvent.click(button);expect(fetch).toHaveBeenCalledTimes(1);
});
