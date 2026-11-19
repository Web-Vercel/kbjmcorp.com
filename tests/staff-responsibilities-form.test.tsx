// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Form from '@/components/operations/StaffResponsibilitiesForm';
const staff=[{user_id:'preparer',role:'operator',active:true,label:'Finance preparer',assignments:[{unit:'zhidian_cn',role:'finance_preparer',active:true}]},{user_id:'reviewer',role:'operator',active:true,label:'Finance reviewer',assignments:[{unit:'zhidian_cn',role:'finance_reviewer',active:true}]}];
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('retains the selected finance duty after saving and re-enables that exact duty',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({})});vi.stubGlobal('fetch',fetch);
 render(<Form locale="zh" staff={staff}/>);
 expect(screen.getByLabelText('要调整的职责').getAttribute('required')).not.toBeNull();
 fireEvent.change(screen.getByLabelText('要调整的职责'),{target:{value:'zhidian_cn:finance_preparer'}});
 fireEvent.change(screen.getByLabelText('启用状态'),{target:{value:'no'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'保存内部职责'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toBe('已保存。'));
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({userId:'preparer',unit:'zhidian_cn',role:'finance_preparer',active:'no'});
 expect((screen.getByLabelText('要调整的职责') as HTMLSelectElement).value).toBe('zhidian_cn:finance_preparer');
 fireEvent.change(screen.getByLabelText('启用状态'),{target:{value:'yes'}});
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'保存内部职责'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({unit:'zhidian_cn',role:'finance_preparer',active:'yes'});
});
it('includes revoked duties for restoration and clears selections when changing person',()=>{
 render(<Form locale="zh" staff={[{...staff[0],assignments:[{unit:'zhidian_cn',role:'finance_preparer',active:false}]},staff[1]]}/>);
 fireEvent.change(screen.getByLabelText('要调整的职责'),{target:{value:'zhidian_cn:finance_preparer'}});
 expect((screen.getByLabelText('启用状态') as HTMLSelectElement).value).toBe('no');
 fireEvent.change(screen.getByLabelText('已核实的内部操作员'),{target:{value:'reviewer'}});
 expect((screen.getByLabelText('要调整的职责') as HTMLSelectElement).value).toBe('');
 expect((screen.getByLabelText('启用状态') as HTMLSelectElement).disabled).toBe(true);
 expect(screen.queryByText(/本次调整/)).toBeNull();
});
