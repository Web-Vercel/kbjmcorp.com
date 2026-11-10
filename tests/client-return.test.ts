import {it,expect} from 'vitest';
import {clientStatementReturnTo,clientLoginDestination} from '@/lib/auth/client-return';
const id='b0000000-0000-4000-8000-000000000001';
it('preserves validated statement filters and anchors while adapting the locale',()=>{
 const target=`/zh/account/statements?wallet=${id}&month=2026-10&statement=${id}#statement-${id}`;
 expect(clientStatementReturnTo(target,'en')).toBe(target.replace('/zh/','/en/'));
 const login=new URL(clientLoginDestination('zh',target),'https://example.test');expect(login.pathname).toBe('/zh/login');expect(login.searchParams.get('returnTo')).toBe(target);
 expect(clientStatementReturnTo('/zh/account/statements?wallet=&month=','zh')).toBe('/zh/account/statements');
});
it.each([undefined,null,['/zh/account/statements'],'https://evil.example/zh/account/statements','//evil.example/zh/account/statements','javascript:alert(1)','/zh/admin','/zh/operations/settlements','/zh/account','/zh/account/../account/statements','/zh/%61ccount/statements','/zh/account/statements\\evil','/zh/account/statements\n','/zh/account/statements?next=https://evil.example','/zh/account/statements?statement=invalid','/zh/account/statements?month=2026-13',`/zh/account/statements?statement=${id}&statement=${id}`,`/zh/account/statements?statement=${id}#wrong-anchor`])('rejects unsafe or ambiguous destinations (%s)',target=>{
 expect(clientStatementReturnTo(target,'zh')).toBeNull();expect(clientLoginDestination('zh',target)).toBe('/zh/login');
});

it('keeps the statement-only helper narrow while allowing validated request context for login',async()=>{
 const {clientReturnTo}=await import('@/lib/auth/client-return');const ticket='b0000000-0000-4000-8000-000000000002';const target=`/zh/account/service?ticket=${ticket}&statement=${id}#service-request-${ticket}`;
 expect(clientStatementReturnTo(target,'zh')).toBeNull();expect(clientReturnTo(target,'en')).toBe(target.replace('/zh/','/en/'));expect(new URL(clientLoginDestination('zh',target),'https://example.test').searchParams.get('returnTo')).toBe(target);
 for(const bad of ['/zh/account/service?ticket=invalid','/zh/account/service?month=2026-10',`/zh/account/service?ticket=${ticket}&ticket=${ticket}`,`/zh/account/service?ticket=${ticket}#service-request-${id}`,'/zh/account/service?next=https://evil.example'])expect(clientReturnTo(bad,'zh')).toBeNull();
});
