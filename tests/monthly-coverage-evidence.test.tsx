// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Evidence,{type CoverageSource} from '@/components/operations/MonthlyCoverageEvidence';
afterEach(cleanup);
const source:CoverageSource={snapshot_id:'source-example',account_name:'FICTIONAL ACCOUNT',since:'2024-01-01',until:'2024-01-31',currency:'CAD',coverage_valid:true,settlement_ready:false,daily_spend_micros:'0',observed_impressions:'0',observed_clicks:'0'};
it('distinguishes zero usage from not-active accounts and requires independent-evidence inputs',()=>{
 render(<Evidence locale="zh" source={source} requestId="request-example"/>);expect(screen.getByRole('option',{name:'账户已启用，整月零使用'})).toBeDefined();expect(screen.getByRole('option',{name:'该月份账户尚未启用'})).toBeDefined();
 fireEvent.change(screen.getByLabelText('已核实的整月活动情况'),{target:{value:'not_active'}});expect((screen.getByLabelText(/经核实的账户启用日期/) as HTMLInputElement).required).toBe(true);expect((screen.getByLabelText('原件 SHA-256（必填）') as HTMLInputElement).required).toBe(true);expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});
it('does not offer a zero-use declaration for known nonzero source activity',()=>{
 render(<Evidence locale="zh" source={{...source,daily_spend_micros:'1',observed_impressions:'1'}} requestId="request-example"/>);expect(screen.queryByRole('option',{name:'账户已启用，整月零使用'})).toBeNull();expect(screen.getByRole('option',{name:/整月内有投放/})).toBeDefined();expect((screen.getByLabelText('平台整月报告花费须与此数一致（CAD）') as HTMLInputElement).readOnly).toBe(true);
});
