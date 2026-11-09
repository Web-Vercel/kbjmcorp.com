// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Prepare,{sourceReady,type MonthlySource} from '@/components/operations/MonthlySettlementPrepare';
afterEach(cleanup);
const source:MonthlySource={snapshot_id:'snapshot-example',account_name:'FICTIONAL ACCOUNT',since:'2024-01-01',until:'2024-01-31',currency:'CAD',period_spend_micros:'100005000',source_check:'matched',missing_dates:[],end_boundary:'exclusive',daily:Array.from({length:31},(_,i)=>({date:`2024-01-${String(i+1).padStart(2,'0')}`}))};
it('does not offer pending, partial-month or unverified sources for preparation',()=>{
 expect(sourceReady(source)).toBe(true);expect(sourceReady({...source,missing_dates:['2024-01-31']})).toBe(false);expect(sourceReady({...source,since:'2024-01-25'})).toBe(false);
 render(<Prepare locale="zh" sources={[{...source,source_check:'no_data'}]} quotes={[]}/>);expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText(/暂无具备制单条件/)).toBeDefined();
});
it('offers only the selected source month quotes and leaves agreement confirmation explicit',()=>{
 render(<Prepare locale="zh" sources={[source]} quotes={[{id:'quote-jan',period:'2024-01-01',revision:1,total_cny_minor:'12345'},{id:'quote-feb',period:'2024-02-01',revision:2,total_cny_minor:'67890'}]}/>);
 fireEvent.change(screen.getByLabelText('完整自然月来源'),{target:{value:source.snapshot_id}});expect(screen.getByRole('option',{name:/2024-01 · V1/})).toBeDefined();expect(screen.queryByRole('option',{name:/2024-02 · V2/})).toBeNull();expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});

it('accepts independently verified zero-usage coverage while retaining unknown empty sources as blocked',()=>{
 const zero={...source,source_check:'no_data',daily:[],missing_dates:source.daily.map(d=>d.date),period_spend_micros:null};
 expect(sourceReady(zero)).toBe(false);expect(sourceReady({...zero,settlement_ready:true,effective_amount_micros:'0',coverage_kind:'reviewed_zero'})).toBe(true);expect(sourceReady({...source,settlement_ready:false})).toBe(false);
});
