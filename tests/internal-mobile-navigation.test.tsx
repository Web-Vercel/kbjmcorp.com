// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({path:'/zh/operations/collections'}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path}));
import Navigation from '@/components/workspace/InternalNavigation';
afterEach(cleanup);
it('lets staff expand the inline mobile menu and closes it after changing task',()=>{
 const props={locale:'zh' as const,context:{owner:true,roles:[],canSource:true,canPrepare:true,canReview:true,canSupport:true},canManage:true,admin:true};
 const {rerender}=render(<Navigation {...props}/>);const toggle=screen.getByRole('button',{name:/工作菜单/});
 expect(toggle.getAttribute('aria-expanded')).toBe('false');fireEvent.click(toggle);expect(toggle.getAttribute('aria-expanded')).toBe('true');
 expect(screen.getByRole('navigation').getAttribute('data-expanded')).toBe('true');state.path='/zh/admin/crm';rerender(<Navigation {...props}/>);expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
