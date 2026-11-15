import {beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({context:vi.fn(),path:"/zh/access/analytics"}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path,notFound:()=>{throw Error('not_found')},redirect:(url:string)=>{throw Error(url)}}));
vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.context}));
vi.mock('@/components/SignOutButton',()=>({default:()=> <button>退出登录</button>}));
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
 m.context.mockResolvedValue({context:{role:'client'},user:{email:'client@example.com'},client:{auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}}}});
 const html=renderToStaticMarkup(await Security({params:Promise.resolve({locale:'zh'})}));
 expect(html).toContain('无需设置验证器');expect(html).toContain('client@example.com');
});

it('offers the same customer task menu across portal and statement pages',()=>{
 const portal=renderToStaticMarkup(<Navigation locale="zh" section="access" role="client"/>);
 const account=renderToStaticMarkup(<Navigation locale="zh" section="account" role="client"/>);
 for(const html of [portal,account]){expect(html).toContain('/account/statements');expect(html).toContain('/account/funds');expect(html).toContain('/account/service');expect(html).not.toContain('/access/investor');expect(html).not.toContain('/account/application');}
});

beforeEach(()=>{m.path='/zh/access/analytics';});
it.each(['client','investor','sales',undefined] as const)('never renders business navigation on the login page (%s)',role=>{
 m.path='/zh/access/login';expect(renderToStaticMarkup(<Navigation locale="zh" section="access" role={role}/>)).toBe('');
});
it('does not render portal navigation before verified access',()=>{
 expect(renderToStaticMarkup(<Navigation locale="zh" section="access"/>)).toBe('');
});

it('provides one sign-out action in the shared client menu',()=>{
 const html=renderToStaticMarkup(<Navigation locale="zh" section="account" role="client"/>);
 expect(html.match(/退出登录/g)).toHaveLength(1);
});
it('keeps agent navigation, sign-out and password recovery reachable on account security',async()=>{m.context.mockResolvedValue({context:{role:'agent'},user:{email:'agent@example.test'}});const html=renderToStaticMarkup(await Security({params:Promise.resolve({locale:'zh'})}));expect(html).toContain('/zh/agent/clients');expect(html).toContain('/zh/agent/settlements');expect(html).toContain('/zh/auth/recovery');expect(html).toContain('退出登录');expect(html).not.toContain('/operations');});

const preparer={owner:false,roles:[{unit:'zhidian_cn',role:'finance_preparer'}],canPrepare:true,canReview:false,canSource:false,canSupport:false};
it.each([{...preparer}, {...preparer,canPrepare:false,canReview:true}])('filters finance navigation to accessible destinations without hiding read-only finance work',context=>{
 m.path='/zh/operations/agents';const html=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={context}/>);
 for(const route of ['staff','ads-reporting','manual-accounts','upstream'])expect(html).not.toContain(`href="/zh/operations/${route}"`);
 for(const route of ['agents','refunds','manual-sources','manual-finance','fund-summary','service-requests','month-close','source-data','source-checks','pricing','settlements','collections','funds','upstream-payments','statement-questions'])expect(html).toContain(`href="/zh/operations/${route}"`);
 expect(html).toContain('报价查看');expect(html).not.toContain('报价管理');
});
it('retains administrator entries and hides unverified operational permissions',()=>{
 m.path='/en/operations';const html=renderToStaticMarkup(<Navigation locale="en" section="operations" operationsContext={{...preparer,owner:true}}/>);
 for(const route of ['staff','ads-reporting','manual-accounts','upstream'])expect(html).toContain(`href="/en/operations/${route}"`);
 expect(html).toContain('Pricing');const unavailable=renderToStaticMarkup(<Navigation locale="en" section="operations"/>);expect(unavailable).not.toContain('/operations/staff');expect(unavailable).not.toContain('/operations/collections');expect(unavailable).toContain('href="/en/operations"');
});
it('keeps source and support role destinations distinct',()=>{
 m.path='/zh/operations';const source=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={{...preparer,canPrepare:false,canSource:true}}/>);
 expect(source).toContain('/operations/manual-accounts');expect(source).toContain('/operations/manual-sources');expect(source).not.toContain('/operations/collections');expect(source).not.toContain('/operations/service-requests');
 const support=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={{...preparer,canPrepare:false,canSupport:true}}/>);expect(support).toContain('/operations/service-requests');expect(support).not.toContain('/operations/manual-accounts');expect(support).not.toContain('/operations/settlements');
});
