import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),cfg:vi.fn(),limit:vi.fn(),rpc:vi.fn(),create:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:(s:{status:number})=>new Response(null,{status:s.status})}));vi.mock('@/lib/auth/privileged-config',()=>({getPrivilegedConnection:m.cfg}));vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:m.limit}));vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{admin:{createUser:m.create}}})}));
import {POST} from '@/app/api/admin/live-account-create/route';
const id='b0000000-0000-4000-8000-000000000001',password='FICTIONAL-STRONG-PASSWORD';const body={email:'fixture@example.test',password,label:'investor-demo',role:'investor',organizationId:id,note:'Verified authorization reference',confirm:'on'};const req=(value:unknown=body)=>new Request('https://site.example/api/admin/live-account-create',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.clearAllMocks();m.cfg.mockReturnValue({url:'https://fixture.supabase.co',key:'FICTIONAL-SERVER-ONLY'});m.limit.mockResolvedValue(0);m.rpc.mockResolvedValue({data:1,error:null});m.create.mockResolvedValue({data:{user:{id}},error:null});const q={select:()=>q,eq:()=>q,limit:async()=>({data:[],error:null}),maybeSingle:async()=>({data:{id},error:null})};m.from.mockReturnValue(q);m.guard.mockResolvedValue({role:'admin',user:{id},client:{from:m.from,rpc:m.rpc}});});
it('requires explicit verification and admin access; never accepts an admin target role',async()=>{
 expect((await POST(req({...body,confirm:undefined}))).status).toBe(400);expect((await POST(req({...body,role:'admin'}))).status).toBe(400);m.guard.mockResolvedValue({role:'operator'});expect((await POST(req())).status).toBe(403);expect(m.create).not.toHaveBeenCalled();
});
it('creates a verified Auth identity only after setup checks and provisions access paused without returning the password',async()=>{
 const r=await POST(req());expect(r.status).toBe(200);expect(m.create).toHaveBeenCalledWith({email:body.email,password,email_confirm:true});expect(m.rpc).toHaveBeenCalledWith('set_live_account_access',expect.objectContaining({p_role:'investor',p_org:id,p_active:false,p_revision:0}));const text=await r.text();expect(text).not.toContain(password);expect(JSON.parse(text)).toMatchObject({ok:true,userId:id,organizationId:id,role:'investor',active:false});
});
it('reports an incomplete authorization with the created ID so the administrator can recover without another Auth user',async()=>{
 m.rpc.mockResolvedValue({error:{code:'40001'}});const r=await POST(req());expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'provisioning_incomplete',userId:id});expect(m.create).toHaveBeenCalledTimes(1);
});
it('fails closed before Auth creation if the existing schema or server credentials are unavailable',async()=>{
 m.cfg.mockReturnValue(null);expect((await POST(req())).status).toBe(503);expect(m.create).not.toHaveBeenCalled();
});
