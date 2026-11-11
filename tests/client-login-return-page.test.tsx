// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('@/lib/auth/config',()=>({getAuthConfig:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:vi.fn(),refresh:vi.fn()}),notFound:()=>{throw new Error('Not found');}}));
import Login from '@/app/[locale]/login/page';
const id='b0000000-0000-4000-8000-000000000001';const target=`/zh/account/statements?statement=${id}#statement-${id}`;
it('retains statement context in the language switch without exposing any test-login entry',async()=>{
 const html=renderToStaticMarkup(await Login({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({returnTo:target})}));const doc=new DOMParser().parseFromString(html,'text/html');const link=doc.querySelector('a.language')!;const en=new URL(link.getAttribute('href')!,'https://example.test');expect(en.pathname).toBe('/en/login');expect(en.searchParams.get('returnTo')).toBe(target);expect(html).toContain('验证成功后将返回原账单');expect(html).not.toContain('/test-login');
 const english=renderToStaticMarkup(await Login({params:Promise.resolve({locale:'en'}),searchParams:Promise.resolve({returnTo:target})}));expect(english).toContain('After verification, return to your statement');expect(english).not.toContain('/test-login');
});
it('ignores a forged return address and preserves the application flow priority',async()=>{
 for(const query of [{returnTo:'https://evil.example'},{flow:'application',returnTo:target}]){const html=renderToStaticMarkup(await Login({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve(query)}));expect(html).not.toContain('验证成功后将返回原账单');expect(html).not.toContain('evil.example');if('flow'in query)expect(html).toContain('/en/login?flow=application');}
});

it('shows request-specific login context without exposing a test entry',async()=>{
 const ticket='b0000000-0000-4000-8000-000000000002';const target=`/zh/account/service?ticket=${ticket}&statement=${id}#service-request-${ticket}`;const html=renderToStaticMarkup(await Login({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({returnTo:target})}));expect(html).toContain('验证成功后将返回原工单');expect(html).not.toContain('/test-login');const doc=new DOMParser().parseFromString(html,'text/html');expect(new URL(doc.querySelector('a.language')!.getAttribute('href')!,'https://example.test').searchParams.get('returnTo')).toBe(target);
});

it('explains funds-specific login return and preserves the selected wallet/month across languages',async()=>{
 const target=`/zh/account/funds?wallet=${id}&month=2026-10`;
 for(const locale of ['zh','en']){const html=renderToStaticMarkup(await Login({params:Promise.resolve({locale}),searchParams:Promise.resolve({returnTo:target})}));expect(html).toContain(locale==='zh'?'验证成功后将返回原资金账户及对账月份':'return to the original wallet and reconciliation month');expect(html).not.toContain('/test-login');const doc=new DOMParser().parseFromString(html,'text/html');const href=new URL(doc.querySelector('a.language')!.getAttribute('href')!,'https://example.test');expect(new URL(href.searchParams.get('returnTo')!,'https://example.test').searchParams.get('wallet')).toBe(id);expect(new URL(href.searchParams.get('returnTo')!,'https://example.test').searchParams.get('month')).toBe('2026-10');}
});
