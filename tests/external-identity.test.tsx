import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({path:'/zh/account/statements',context:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path,notFound:()=>{throw new Error('not-found')},useRouter:()=>({refresh:()=>{}})}));
vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.context}));
vi.mock('@/components/SignOutButton',()=>({default:()=>null}));
import Identity from '@/components/session/ExternalIdentityBar';
import Account from '@/app/[locale]/account/layout';
import Access from '@/app/[locale]/access/layout';
import Agent from '@/app/[locale]/agent/layout';
const userId='ae000000-0000-4000-8000-000000000001';
beforeEach(()=>{m.path='/zh/account/statements';vi.clearAllMocks();});
it('shows the verified user email, account label, role and company on every customer account route',async()=>{
 for(const [email,label,company] of [['client-a@example.test','客户甲','企业甲'],['client-b@example.test','客户乙','企业乙']]){
  m.context.mockResolvedValue({user:{id:userId,email},context:{role:'client',label,organization_name:company}});
  const html=renderToStaticMarkup(await Account({params:Promise.resolve({locale:'zh'}),children:<p>账单</p>}));for(const value of [email,label,company,'企业客户','当前登录身份'])expect(html).toContain(value);
  expect(html).not.toContain(email.includes('-a')?'client-b@example.test':'client-a@example.test');
 }
});
it('identifies agents without mislabelling their agent record as a customer company',async()=>{
 m.path='/zh/agent/commissions';m.context.mockResolvedValue({user:{email:'agent@example.test'},context:{role:'agent',label:'代理甲',organization_name:'代理门户'}});
 const html=renderToStaticMarkup(await Agent({params:Promise.resolve({locale:'zh'}),children:<p>佣金</p>}));expect(html).toContain('agent@example.test');expect(html).toContain('外部合作代理');expect(html).toContain('本人代理业务');expect(html).not.toContain('所属企业');
});
it('keeps login pages free of a previous account banner and renders no unverified identity',async()=>{
 m.path='/zh/access/login';expect(renderToStaticMarkup(<Identity locale="zh" email="old@example.test" role="client" label="Old" company="Old company"/>)).toBe('');
 m.path='/zh/access';m.context.mockResolvedValue({error:'forbidden'});const html=renderToStaticMarkup(await Access({params:Promise.resolve({locale:'zh'}),children:<p>Access unavailable</p>}));expect(html).not.toContain('当前登录身份');expect(html).not.toContain('old@example.test');
});
