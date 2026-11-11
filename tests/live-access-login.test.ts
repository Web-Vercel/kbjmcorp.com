import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({client:vi.fn(),config:vi.fn(),limit:vi.fn(),signIn:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));vi.mock('@/lib/auth/server',()=>({authClient:m.client}));vi.mock('@/lib/auth/config',()=>({getStaffLoginConfig:m.config}));vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:m.limit}));
import {POST} from '@/app/api/access/login/route';const id='b0000000-0000-4000-8000-000000000001';const req=()=>new Request('https://site.example/api/access/login',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({email:'fixture@example.test',password:'FICTIONAL',captchaToken:'FICTIONAL-CAPTCHA',role:'admin'})});
beforeEach(()=>{vi.clearAllMocks();m.config.mockReturnValue({});m.limit.mockResolvedValue(0);m.client.mockResolvedValue({auth:{signInWithPassword:m.signIn,signOut:m.signOut},rpc:m.rpc});m.signIn.mockResolvedValue({data:{user:{id}},error:null});m.signOut.mockResolvedValue({error:null});});
it('requires a server-validated active scoped account after real password authentication',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'42501'}});expect((await POST(req())).status).toBe(403);expect(m.signOut).toHaveBeenCalledWith({scope:'local'});m.rpc.mockResolvedValue({data:{user_id:id,organization_id:id,organization_name:'FICTIONAL',role:'investor',label:'investor-demo',revision:1},error:null});const r=await POST(req());expect(await r.json()).toEqual({ok:true,requiresMfa:true});expect(m.limit).toHaveBeenCalledWith('fixture@example.test','live_access');expect(m.rpc).toHaveBeenCalledWith('get_live_account_context',{p_mfa:false});
});
it('fails closed before sign-in if authentication or persistent throttling is unavailable',async()=>{
 m.limit.mockRejectedValue(Error('PRIVATE'));const r=await POST(req());expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE');expect(m.signIn).not.toHaveBeenCalled();
});
