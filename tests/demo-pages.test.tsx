import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),config:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'FICTIONAL-DEMO-COOKIE'})})}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:vi.fn(),refresh:vi.fn()}),redirect:(path:string)=>{throw Error('REDIRECT:'+path)},notFound:()=>{throw Error('NOT_FOUND')}}));
vi.mock('@/lib/demo/session',()=>({demoCookie:'zhidian_demo_session',demoSession:m.session,demoConfig:m.config}));
import Page from '@/app/[locale]/demo/page';
import Login from '@/app/[locale]/demo/login/page';
beforeEach(()=>{vi.clearAllMocks();m.session.mockReturnValue(null);m.config.mockReturnValue(null);});
it('requires a valid server-side demo session, with no role or redirect taken from a URL',async()=>{
 await expect(Page({params:Promise.resolve({locale:'zh'})})).rejects.toThrow('REDIRECT:/zh/demo/login');
 for(const role of ['investor','client','sales']){m.session.mockReturnValue({username:'fictional-demo',role});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'en'})}));expect(html).toContain('fictional-demo');expect(html).toContain('fictional');expect(html).not.toContain('/api/admin');}
});
it('shows an honest disabled sign-in when account settings are unavailable',async()=>{
 const html=renderToStaticMarkup(await Login({params:Promise.resolve({locale:'zh'})}));expect(html).toContain('尚未开通');expect(html).toContain('disabled');expect(html).not.toContain('passwordHash');
});
