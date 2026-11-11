// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import Workspace from '@/components/demo/DemoWorkspace';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps investor views read-only with no real customer data, privilege forms or business requests',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Workspace locale="zh" role="investor" username="investor-demo"/>);for(const name of ['广告客户体验','销售与客户服务','投资人总览']){fireEvent.click(screen.getByRole('button',{name}));expect(document.querySelectorAll('form')).toHaveLength(0);expect(screen.queryByRole('textbox')).toBeNull();}expect(fetcher).not.toHaveBeenCalled();expect(document.body.textContent).toContain('虚构');expect(document.body.textContent).not.toContain('Kenny');
});
it('lets a client create a page-local demo company and question without changing funds or roles',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Workspace locale="zh" role="client" username="client-demo"/>);fireEvent.change(screen.getByLabelText('演示企业名称'),{target:{value:'演示企业B'}});fireEvent.change(screen.getByLabelText('演示月预算（CNY）'),{target:{value:'20000'}});fireEvent.submit(screen.getByRole('button',{name:'保存演示企业'}).closest('form')!);expect(screen.getByRole('status').textContent).toContain('未创建真实企业或扣款');expect(screen.getByText('CNY 3,950.00')).toBeTruthy();expect(screen.queryByRole('button',{name:'投资人总览'})).toBeNull();fireEvent.change(screen.getByLabelText('演示问题'),{target:{value:'请说明服务费'}});fireEvent.submit(screen.getByRole('button',{name:'模拟提交问题'}).closest('form')!);expect(screen.getByText(/模拟待处理：/)).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'重置本页演示'}));expect(screen.queryByText(/模拟待处理：/)).toBeNull();
});
it('limits sales to simulated customer follow-up and clears state on remount',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Workspace locale="en" role="sales" username="sales-demo"/>);fireEvent.change(screen.getByLabelText('Follow-up stage'),{target:{value:'proposal'}});fireEvent.change(screen.getByLabelText('Demo follow-up note'),{target:{value:'Fictional customer contacted'}});fireEvent.submit(screen.getByRole('button',{name:'Save demo follow-up'}).closest('form')!);expect(screen.getByText('Fictional customer contacted')).toBeTruthy();expect(fetcher).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Publish'})).toBeNull();cleanup();render(<Workspace locale="en" role="sales" username="sales-demo"/>);expect(screen.queryByText('Fictional customer contacted')).toBeNull();
});
