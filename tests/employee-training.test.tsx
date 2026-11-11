// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,afterEach,vi} from 'vitest';
import Training from '@/components/demo/EmployeeTraining';
import {demoCapabilities} from '@/lib/demo/policy';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows only assigned tracks and rejects simulated self-review without calling a real API',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Training locale="zh" tracks={['finance_reviewer']}/>);expect(screen.getAllByRole('option')).toHaveLength(4);expect(screen.queryByRole('option',{name:'销售与客户服务'})).toBeNull();fireEvent.change(screen.getByLabelText('复核决定'),{target:{value:'approved'}});fireEvent.change(screen.getByLabelText('练习说明（请勿填写真实资料）'),{target:{value:'虚构审核说明'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('button').closest('form')!);expect(screen.getByRole('status').textContent).toContain('自审被拒绝');fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(screen.getByRole('button').closest('form')!);expect(screen.getByRole('status').textContent).toContain('未扣款');expect(fetcher).not.toHaveBeenCalled();
});
it('does not offer an exercise with no assignment and never grants real business capabilities',()=>{
 render(<Training locale="en" tracks={[]}/>);expect(screen.queryByRole('button')).toBeNull();expect(screen.getByText(/No training track/)).toBeTruthy();for(const caps of Object.values(demoCapabilities)){expect(caps.realBusiness).toBe(false);expect(caps.manageAccess).toBe(false);}expect(demoCapabilities.investor.editFictional).toBe(false);
});
