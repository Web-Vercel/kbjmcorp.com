import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('next/headers',()=>({cookies:async()=>({has:()=>false})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not-found')}}));
vi.mock('@/lib/auth/config',()=>({getStaffLoginConfig:()=>null}));
vi.mock('@/components/admin/StaffLogin',()=>({default:({access}:{access?:boolean})=><p>{access?'external-login-form':'employee-login-form'}</p>}));
import Employees from '@/app/[locale]/admin/login/page';
import External from '@/app/[locale]/access/login/page';
it('clearly separates employee and external entry pages while keeping their existing login flows',async()=>{
 const internal=renderToStaticMarkup(await Employees({params:Promise.resolve({locale:'zh'})}));
 const external=renderToStaticMarkup(await External({params:Promise.resolve({locale:'zh'})}));
 expect(internal).toContain('员工登录');expect(internal).toContain('加拿大与中国');expect(internal).toContain('employee-login-form');expect(internal).toContain('/zh/access/login');
 expect(external).toContain('客户与合作伙伴登录');expect(external).toContain('客户、代理、投资人');expect(external).toContain('external-login-form');expect(external).toContain('/zh/admin/login');
});
