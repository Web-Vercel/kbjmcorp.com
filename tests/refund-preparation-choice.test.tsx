// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import Preparation from '@/components/partners/RefundPreparation';
import Selector from '@/components/partners/RefundRecordSelector';
const id='b0000000-0000-4000-8000-000000000020';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('shows only the selected processing form and sends rejection for the selected record',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,receipt:{id,action:'refund_reject'}}));vi.stubGlobal('fetch',fetcher);render(<Preparation id={id}/>);
 expect(screen.queryByRole('button')).toBeNull();fireEvent.change(screen.getByRole('combobox',{name:'办理操作'}),{target:{value:'reject'}});expect(screen.queryByText('完成核算，提交独立复核')).toBeNull();
 fireEvent.change(screen.getByLabelText('给客户的退回说明'),{target:{value:'TEST missing documents'}});fireEvent.submit(screen.getByRole('button',{name:'退回并解除退款占用'}).closest('form')!);await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({id,action:'refund_reject',note:'TEST missing documents'});
});
it('protects unsaved input and locks both selectors on unknown results',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('network')));render(<Selector locale="zh" items={[{id,label:'CNY 20.00',active:true,content:<Preparation id={id}/>}]}/>);
 const select=screen.getByRole('combobox',{name:'办理操作'});fireEvent.change(select,{target:{value:'prepare'}});fireEvent.change(screen.getByLabelText('未结费用、可退金额、原付款方及退款账户核实依据'),{target:{value:'TEST assessment'}});
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.change(select,{target:{value:'reject'}});expect((select as HTMLSelectElement).value).toBe('prepare');
 confirm.mockReturnValue(true);fireEvent.change(select,{target:{value:'reject'}});fireEvent.change(screen.getByLabelText('给客户的退回说明'),{target:{value:'TEST rejection'}});fireEvent.submit(screen.getByRole('button',{name:'退回并解除退款占用'}).closest('form')!);
 await screen.findByText(/保存结果未知/);expect((select as HTMLSelectElement).disabled).toBe(true);expect((screen.getByRole('combobox',{name:'选择退款申请'}) as HTMLSelectElement).disabled).toBe(true);
});
