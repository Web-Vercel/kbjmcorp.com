// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import StatementDownload from '@/components/billing/StatementDownload';
import {statement} from './fixtures/client-statement';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('downloads the named immutable statement as CSV or printable HTML and cleans links',()=>{
 const create=vi.fn().mockReturnValue('blob:statement');vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:vi.fn()}));const clicked:string[]=[];
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){clicked.push(this.download);});
 render(<StatementDownload statement={statement} zh/>);fireEvent.click(screen.getByRole('button',{name:'下载本账单（CSV）'}));fireEvent.click(screen.getByRole('button',{name:'下载阅读版账单（可打印 PDF）'}));
 expect(clicked).toEqual([`monthly-statement-2026-10-${statement.id}.csv`,`monthly-statement-2026-10-${statement.id}.html`]);expect(create.mock.calls[0][0].type).toBe('text/csv;charset=utf-8');expect(create.mock.calls[1][0].type).toBe('text/html;charset=utf-8');expect(document.querySelector('a[download]')).toBeNull();
});
it('reports a failed local download without claiming success',()=>{
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=>{throw Error('unavailable');}),revokeObjectURL:vi.fn()}));render(<StatementDownload statement={statement} zh/>);fireEvent.click(screen.getByRole('button',{name:'下载本账单（CSV）'}));expect(screen.getByRole('alert').textContent).toContain('下载未完成');
});
