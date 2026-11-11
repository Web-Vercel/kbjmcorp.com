import {it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth/config',()=>({getSessionConfig:()=>null}));
import {proxy} from '@/proxy';
function request(path:string,demo=true){return new NextRequest('https://site.example'+path,{headers:{cookie:`sb-real-auth-token=FICTIONAL-ADMIN-SESSION${demo?'; zhidian_demo_session=FICTIONAL-DEMO':''}`}});}
it('denies real API reads and writes even when a real admin cookie also exists',async()=>{
 for(const path of ['/api/admin/monthly-publications','/api/collections','/api/service/ticket/export','/api/inquiries']){const r=await proxy(request(path));expect(r.status).toBe(403);expect(await r.json()).toEqual({error:'demo_only'});expect(r.headers.get('cache-control')).toContain('no-store');}
});
it('redirects real workspaces into the demo and preserves normal behavior after exit',async()=>{
 for(const path of ['/zh/admin','/zh/operations','/en/account']){const r=await proxy(request(path));expect(r.status).toBe(307);expect(r.headers.get('location')).toBe(`https://site.example/${path.startsWith('/en/')?'en':'zh'}/demo`);}
 expect((await proxy(request('/api/demo/logout'))).headers.get('x-middleware-next')).toBe('1');expect((await proxy(request('/api/demo/login'))).headers.get('x-middleware-next')).toBe('1');expect((await proxy(request('/api/collections',false))).headers.get('x-middleware-next')).toBe('1');
});
