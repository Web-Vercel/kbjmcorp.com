import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({context:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>'/zh/access/analytics',notFound:()=>{throw Error('not_found')},redirect:(url:string)=>{throw Error(url)}}));
vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.context}));
import Navigation from '@/components/BusinessNavigation';
import Security from '@/app/[locale]/access/security/page';
it.each(['client','sales'] as const)('hides investor navigation from %s',role=>{
 const html=renderToStaticMarkup(<Navigation locale="zh" section="access" role={role}/>);
 expect(html).not.toContain('/access/investor');expect(html).toContain('/access/security');
});
it('keeps investor navigation for investors',()=>{
 expect(renderToStaticMarkup(<Navigation locale="zh" section="access" role="investor"/>)).toContain('/access/investor');
});
it('shows verified security status without redirecting an authenticated user',async()=>{
 m.context.mockResolvedValue({user:{email:'client@example.com'},client:{auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}}}});
 const html=renderToStaticMarkup(await Security({params:Promise.resolve({locale:'zh'})}));
 expect(html).toContain('当前登录已完成验证器二次验证');expect(html).toContain('client@example.com');
});
