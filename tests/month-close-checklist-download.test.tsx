// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import Download from '@/components/operations/MonthCloseChecklistDownload';
import {checklist,org} from './fixtures/month-close-checklist';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('downloads only on click and retains the month and company in the file name',async()=>{
 const create=vi.fn().mockReturnValue('blob:fictional');Object.defineProperty(URL,'createObjectURL',{value:create,configurable:true});Object.defineProperty(URL,'revokeObjectURL',{value:vi.fn(),configurable:true});const clicked:string[]=[];vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){clicked.push(this.download);});render(<Download report={checklist()} locale="zh"/>);expect(create).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button'));expect(clicked).toEqual([`internal-month-close-2024-01-${org}.csv`]);expect(create.mock.calls[0][0].type).toBe('text/csv;charset=utf-8');expect(document.querySelector('a[download]')).toBeNull();
});
it('disables export while dependencies are unknown',()=>{render(<Download report={null} locale="zh"/>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText(/暂不提供清单下载/)).toBeTruthy();});
