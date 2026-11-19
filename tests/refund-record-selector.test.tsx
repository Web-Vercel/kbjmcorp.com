// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import Selector from '@/components/partners/RefundRecordSelector';
import ActionForm from '@/components/partners/ActionForm';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();window.history.replaceState(null,'','#');});
const items=[{id:'ten',label:'CNY 10.00',active:true,content:<ActionForm action="refund_cancel" data={{id:'ten'}} button="Cancel ten"/>},{id:'twenty',label:'CNY 20.00',active:true,content:<p>Twenty detail</p>}];
it('keeps unsaved input when switching is declined and resets it after confirmed switching',()=>{
 render(<Selector items={items} locale="zh"/>);fireEvent.change(screen.getByLabelText('办理说明／核实依据'),{target:{value:'UNSAVED'}});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false),select=screen.getByRole('combobox');fireEvent.change(select,{target:{value:'twenty'}});expect((select as HTMLSelectElement).value).toBe('ten');expect((screen.getByLabelText('办理说明／核实依据') as HTMLTextAreaElement).value).toBe('UNSAVED');
 confirm.mockReturnValue(true);fireEvent.change(select,{target:{value:'twenty'}});expect(screen.getByText('Twenty detail')).toBeTruthy();fireEvent.change(select,{target:{value:'ten'}});expect((screen.getByLabelText('办理说明／核实依据') as HTMLTextAreaElement).value).toBe('');
});
it('prevents switching while a submission is pending or its outcome is unknown',async()=>{
 let reject!:(e:Error)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise((_ok,no)=>{reject=no;})));render(<Selector items={items} locale="zh"/>);fireEvent.change(screen.getByLabelText('办理说明／核实依据'),{target:{value:'TEST cancellation'}});fireEvent.submit(screen.getByRole('button',{name:'Cancel ten'}).closest('form')!);
 await waitFor(()=>expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true));reject(Error('network'));await screen.findByText(/保存结果未知/);expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
});
