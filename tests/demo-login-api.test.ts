import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({limit:vi.fn(),config:vi.fn(),login:vi.fn()}));
vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:m.limit}));vi.mock('@/lib/demo/session',()=>({demoConfig:m.config,demoLogin:m.login,demoCookie:'zhidian_demo_session'}));
import {POST} from '@/app/api/demo/login/route';
import {POST as logout} from '@/app/api/demo/logout/route';
const req=(body:unknown,origin='https://site.example')=>new Request('https://site.example/api/demo/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.config.mockReturnValue({});m.limit.mockResolvedValue(0);m.login.mockResolvedValue({token:'FICTIONAL-SIGNED-TOKEN',role:'client'});});
it('sets only the independent HttpOnly demo cookie, ignoring a requested admin role or redirect',async()=>{
 const r=await POST(req({username:'CLIENT-DEMO',password:'fictional',role:'admin',returnTo:'/zh/admin'}));expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true});expect(m.login).toHaveBeenCalledWith('client-demo','fictional');expect(m.limit).toHaveBeenCalledWith('client-demo','demo');const cookie=r.headers.get('set-cookie')!;expect(cookie).toContain('zhidian_demo_session=');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=strict');expect(cookie).not.toMatch(/sb-|supabase/);expect(r.headers.get('cache-control')).toContain('no-store');
});
it('requires same origin and persistent rate limits before password verification',async()=>{
 expect((await POST(req({username:'client-demo',password:'fictional'},'https://evil.example'))).status).toBe(403);expect(m.login).not.toHaveBeenCalled();m.limit.mockResolvedValue(60);expect((await POST(req({username:'client-demo',password:'fictional'}))).status).toBe(429);expect(m.login).not.toHaveBeenCalled();m.limit.mockRejectedValue(Error('PRIVATE'));const r=await POST(req({username:'client-demo',password:'fictional'}));expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE');expect(m.login).not.toHaveBeenCalled();
});
it('denies unconfigured, invalid and expired accounts without a session',async()=>{
 m.config.mockReturnValue(null);expect((await POST(req({username:'client-demo',password:'fictional'}))).status).toBe(503);m.config.mockReturnValue({});m.login.mockResolvedValue(null);const r=await POST(req({username:'client-demo',password:'fictional'}));expect(r.status).toBe(401);expect(r.headers.get('set-cookie')).toBeNull();
});
it('signs out only the demo session with same-origin protection',async()=>{
 expect((await logout(req({},'https://evil.example'))).status).toBe(403);const r=await logout(req({}));expect(r.headers.get('set-cookie')).toContain('Max-Age=0');expect(r.headers.get('set-cookie')).not.toMatch(/sb-|supabase/);
});
