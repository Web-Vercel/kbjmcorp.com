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
it('names reviewer tasks as review without granting preparer or administrator destinations',()=>{
 m.path='/zh/operations';const html=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={{...preparer,canPrepare:false,canReview:true}}/>);
 for(const text of ['月度结算复核','收款到账复核','代理佣金与结算复核','客户退款复核','月度数据完整性核对','公司间到账复核','报价查看'])expect(html).toContain(text);
 expect(html).not.toContain('平台数据同步');expect(html).not.toContain('人员职责');
});
it.each([false,true])('ties every remaining finance destination to its preparer or reviewer duty (reviewer=%s)',reviewer=>{
 m.path='/zh/operations';const context={...preparer,canPrepare:!reviewer,canReview:reviewer};
 const html=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={context}/>);
 const expected=['agents','refunds','manual-sources','manual-finance','fund-summary','service-requests','month-close','source-data','source-checks','pricing','settlements','collections','funds','upstream-payments','statement-questions'];
 const links=[...html.matchAll(/href="\/zh\/operations\/([^"?#]+)"/g)].map(m=>m[1]);expect(links.sort()).toEqual(expected.sort());
 expect(html).toContain('财务咨询工单');expect(html).toContain('广告数据与凭证');expect(html).toContain('手工提交平台报表');expect(html).not.toContain('>代理业务<');
 if(reviewer){expect(html).toContain('月度结算复核');expect(html).not.toContain('月度结算制单');}else{expect(html).toContain('月度结算制单');expect(html).toContain('手工草稿进度');expect(html).toContain('退款核算与登记');}
});
it.each([false,true])('keeps home destinations aligned with the financial role menu (reviewer=%s)',async reviewer=>{
 const Home=(await import('@/components/operations/OperationsHomeMenu')).default;
 const context={...preparer,canPrepare:!reviewer,canReview:reviewer};
 const html=renderToStaticMarkup(<Home locale="zh" context={context} finance source={false} owner={false} support={false}/>);
 const routes=[...html.matchAll(/href="\/zh\/operations\/([^"?#]+)"/g)].map(m=>m[1]);expect(routes).toHaveLength(8);
 for(const forbidden of ['staff','ads-reporting','manual-accounts','upstream'])expect(routes).not.toContain(forbidden);
 for(const label of ['问题中心','月结办理','来源核对','资金查询','公司间对账'])expect(html).toContain(label);
});
it('uses consistent administrator module names in both the home menu and workspace navigation',async()=>{
 m.path='/zh/operations';const context={...preparer,owner:true,canPrepare:true,canReview:true};
 const Home=(await import('@/components/operations/OperationsHomeMenu')).default;
 const nav=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={context}/>),home=renderToStaticMarkup(<Home locale="zh" context={context} finance source owner support/>);
 for(const name of ['代理与佣金管理','对公收款与入账','手工账户归属关联']){expect(nav).toContain(name);expect(home).toContain(name);}
 for(const name of ['月结办理','来源核对','资金查询','公司间对账','问题中心'])expect(home).toContain(name);
});
it.each(['investor','sales'] as const)('keeps %s navigation in its read-only/follow-up portal even on a legacy account URL',role=>{
 m.path='/zh/account/funds';const html=renderToStaticMarkup(<Navigation locale="zh" section="account" role={role}/>);
 expect(html).toContain('/zh/access/analytics');expect(html).toContain('/zh/access/security');
 for(const route of ['application','company','statements','funds','service','refunds'])expect(html).not.toContain(`href="/zh/account/${route}"`);
 expect(html.includes('/access/investor')).toBe(role==='investor');
 if(role==='sales')expect(html).toContain('客户跟进分析');
});
it('accurately labels the client monthly-funds destination',()=>{
 m.path='/zh/account/funds';const html=renderToStaticMarkup(<Navigation locale="zh" section="account" role="client"/>);expect(html).toContain('月度资金对账');expect(html).not.toContain('资金与流水');expect(html).toContain('/account/refunds');
});

it('shows the management workspace switch outside the collapsed menu only after verified access',()=>{
 m.path='/zh/operations';
 const html=renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={{...preparer,owner:true}} canAdminWorkspace/>);
 expect(html).toContain('href="/zh/admin"');expect(html.indexOf('← 业务管理中心')).toBeLessThan(html.indexOf('<details'));
 for(const context of [preparer,{...preparer,canPrepare:false,canReview:true}]){
  expect(renderToStaticMarkup(<Navigation locale="zh" section="operations" operationsContext={context}/>)).not.toContain('href="/zh/admin"');
 }
 const support=renderToStaticMarkup(<Navigation locale="en" section="operations" operationsContext={{...preparer,canSupport:true}} canAdminWorkspace/>);
 expect(support).toContain('href="/en/admin"');expect(support).toContain('Business management center');
 expect(renderToStaticMarkup(<Navigation locale="zh" section="account" role="client" canAdminWorkspace/>)).not.toContain('href="/zh/admin"');
});

it.each(['zh','en'] as const)('exposes balances in the client menu and highlights balances and payment notices (%s)',locale=>{
 for(const page of ['transactions','payment-notices']){
  m.path=`/${locale}/account/${page}`;
  const html=renderToStaticMarkup(<Navigation locale={locale} section="account" role="client"/>);
  expect(html).toContain(`aria-current="page" href="/${locale}/account/transactions"`);
  expect(html).not.toContain(`aria-current="page" href="/${locale}/access"`);
  expect(html).toContain(locale==='zh'?'余额与流水':'Balance and transactions');
 }
 m.path=`/${locale}/access`;
 const overview=renderToStaticMarkup(<Navigation locale={locale} section="access" role="client"/>);
 expect(overview).toContain(`href="/${locale}/account/transactions"`);
 expect(overview).toContain(`aria-current="page" href="/${locale}/access"`);
});
