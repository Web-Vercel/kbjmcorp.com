// @vitest-environment jsdom
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it} from 'vitest';
import AgencyQuoteCalculator from '@/components/operations/AgencyQuoteCalculator';
afterEach(cleanup);
it('calculates a clearly labeled internal quote with no agreed default service charge',async()=>{const user=userEvent.setup();render(<AgencyQuoteCalculator locale="zh"/>);await user.type(screen.getByLabelText('平台原始广告费（CAD）'),'1000');await user.type(screen.getByLabelText('试算汇率：1 CAD 对应人民币'),'5.20');await user.click(screen.getByRole('button',{name:'试算两家公司费用'}));expect(screen.getByText('试算拆分')).toBeTruthy();expect(screen.getAllByText('CNY 5,200.00')).toHaveLength(2);expect(screen.getByText(/不等于净利润/)).toBeTruthy();});
it('offers automatic reference mode without silently using a missing rate',async()=>{const user=userEvent.setup();render(<AgencyQuoteCalculator locale="zh"/>);await user.selectOptions(screen.getByLabelText('汇率方式'),'automatic');expect(screen.queryByLabelText('试算汇率：1 CAD 对应人民币')).toBeNull();expect((screen.getByLabelText('所用汇率是否已经包含服务商汇差／手续费') as HTMLSelectElement).disabled).toBe(true);expect(screen.getByRole('button',{name:'获取参考汇率'})).toBeTruthy();});
