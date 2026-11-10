// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import Summary from '@/components/operations/CadAllocationSummary';
import {report,id} from './fixtures/cad-allocation-report';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('downloads a scoped file only on click, with the correct whole-month verified amounts',async()=>{
 const create=vi.fn().mockReturnValue('blob:fictional');Object.defineProperty(URL,'createObjectURL',{value:create,configurable:true});Object.defineProperty(URL,'revokeObjectURL',{value:vi.fn(),configurable:true});const files:string[]=[];vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){files.push(this.download);});render(<Summary report={report()} locale="zh"/>);expect(create).not.toHaveBeenCalled();expect(screen.getByText('CAD 80.00')).toBeTruthy();expect(screen.getByText('CAD 20.00')).toBeTruthy();await userEvent.click(screen.getByRole('button'));expect(files).toEqual([`internal-cad-allocation-2024-01-${id(1)}.csv`]);expect(document.querySelector('a[download]')).toBeNull();
});
it('does not offer export or a false zero when report data is incomplete',()=>{
 render(<Summary report={null} locale="zh"/>);expect(screen.getByText(/未知合计不显示为零/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();expect(screen.queryByText('CAD 0.00')).toBeNull();
});
