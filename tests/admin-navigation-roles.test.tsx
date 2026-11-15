import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/navigation',()=>({usePathname:()=>'/zh/admin'}));
import Navigation from '@/components/admin/AdminNavigation';
it('keeps account authorization and collection administration in the administrator sidebar',()=>{
 const html=renderToStaticMarkup(<Navigation locale="zh" demo={false} staffRole="admin"/>);
 for(const route of ['role-accounts','clients','crm','applications'])expect(html).toContain(`/zh/admin/${route}`);expect(html).toContain('/operations/collections');expect(html).toContain('项目协作权限');
});
it('gives customer-service staff their CRM workflow without administrator grants or bank-entry shortcuts',()=>{
 const html=renderToStaticMarkup(<Navigation locale="zh" demo={false} staffRole="operator"/>);
 for(const route of ['inquiries','projects','accounts','applications','crm'])expect(html).toContain(`/zh/admin/${route}`);
 expect(html).not.toContain('/admin/role-accounts');expect(html).not.toContain('/admin/clients');expect(html).not.toContain('/operations/collections');expect(html).toContain('href="/zh/operations"');
});
it('does not assume administrator permission when a verified role is absent',()=>{
 const html=renderToStaticMarkup(<Navigation locale="en" demo={false}/>);expect(html).not.toContain('/admin/role-accounts');expect(html).not.toContain('/admin/clients');expect(html).not.toContain('/operations/collections');
});
