// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import Roadshow from '@/components/demo/InvestorRoadshow';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens directly into concrete records and browses all six modules without business requests or mutation controls',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Roadshow locale="zh"/>);expect(screen.getAllByRole('tab')).toHaveLength(6);expect(screen.getByRole('tabpanel').textContent).toContain('星禾家居');const labels=['客户管理','广告报表','两地收费与月结','客户账单','人民币资金流水','公司间核销'];
 for(let i=0;i<labels.length;i++){const panel=screen.getByRole('tabpanel');expect(within(panel).getByRole('heading',{level:2}).textContent).toBe(labels[i]);expect(within(panel).getByRole('table')).toBeTruthy();expect(panel.querySelectorAll('input,textarea,form')).toHaveLength(0);if(i<5)fireEvent.click(screen.getByRole('button',{name:'下一步演示'}));}
 expect(screen.getByRole('tabpanel').textContent).toContain('CAD 0.00');expect(screen.getByRole('tabpanel').textContent).toContain('CNY 3,950.00');fireEvent.click(screen.getByRole('button',{name:'重新浏览完整案例'}));expect(within(screen.getByRole('tabpanel')).getByRole('heading',{level:2}).textContent).toBe('客户管理');expect(fetcher).not.toHaveBeenCalled();
});
it('supports direct report and ledger exploration with coherent sample results in English',()=>{
 render(<Roadshow locale="en"/>);fireEvent.click(screen.getByRole('tab',{name:'2. Advertising report'}));expect(screen.getByRole('tabpanel').textContent).toContain('50,000');expect(screen.getByRole('tabpanel').textContent).toContain('2.00%');fireEvent.click(screen.getByRole('tab',{name:'5. CNY ledger'}));expect(screen.getByRole('tabpanel').textContent).toContain('10,000.00 − 5,500.00 − 550.00 = CNY 3,950.00');expect(screen.getByRole('tab',{name:'5. CNY ledger'}).getAttribute('aria-selected')).toBe('true');expect(screen.getByText(/Fictional|FICTIONAL/)).toBeTruthy();
});
