// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
const push=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({push})}));
import Picker from '@/components/billing/StatementPicker';
afterEach(()=>{cleanup();push.mockClear();});
it('switches months without carrying the previous statement and preserves wallet scope',()=>{render(<Picker locale="zh" wallet="wallet-1" month="2026-10" months={['2026-10','2026-09']} statement="bill-1" statements={[{id:'bill-1',label:'A'},{id:'bill-2',label:'B'}]}/>);fireEvent.change(screen.getByLabelText('结算月份'),{target:{value:'2026-09'}});expect(push).toHaveBeenLastCalledWith('/zh/account/statements?wallet=wallet-1&month=2026-09');fireEvent.change(screen.getByLabelText('广告账户／账单'),{target:{value:'bill-2'}});expect(push).toHaveBeenLastCalledWith('/zh/account/statements?wallet=wallet-1&month=2026-10&statement=bill-2');});
it('hides the extra bill selector for a single bill',()=>{render(<Picker locale="en" wallet="" month="2026-10" months={['2026-10']} statement="bill-1" statements={[{id:'bill-1',label:'A'}]}/>);expect(screen.queryByLabelText('Ad account / statement')).toBeNull();});
