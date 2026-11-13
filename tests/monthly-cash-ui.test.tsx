// @vitest-environment jsdom
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import MonthlyCash,{type MonthlyCashWallet} from '@/components/operations/MonthlyCash';
afterEach(cleanup);
const wallet:MonthlyCashWallet={id:'test',currency:'CNY',month:'2010-01-01',timezone:'Asia/Shanghai',opening_minor:'0',topup_minor:'100001',ad_spend_minor:'0',service_fee_minor:'0',refund_minor:'0',adjustment_minor:'0',closing_minor:'100001',entry_count:'1',as_of:'2010-01-10T00:00:00Z'};
it('labels posted fees without claiming zero advertising use',()=>{render(<MonthlyCash locale="zh" wallets={[wallet]} error={false}/>);expect(screen.getByText(/不能据此判断广告未消费/)).toBeTruthy();expect(screen.getByText('本月广告费入账')).toBeTruthy();expect(screen.getAllByText('CNY 1,000.01').length).toBe(2);});
it('flags mismatched accounting rather than displaying a balanced statement',()=>{render(<MonthlyCash locale="zh" wallets={[{...wallet,closing_minor:'1'}]} error={false}/>);expect(screen.getByText(/账务等式不一致/)).toBeTruthy();expect(screen.queryByText('本月充值入账')).toBeNull();});
it('does not render invented zeros on error',()=>{render(<MonthlyCash locale="en" wallets={[]} error/>);expect(screen.getByText(/Monthly reconciliation is temporarily unavailable/)).toBeTruthy();expect(screen.queryByText('CNY 0.00')).toBeNull();});
