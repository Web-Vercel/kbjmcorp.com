import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),live:vi.fn()}));vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:(s:{status:number})=>new Response(null,{status:s.status})}));vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.live}));
import {POST as manage} from '@/app/api/admin/live-access/route';
import {POST as followup} from '@/app/api/access/followup/route';
const id='b0000000-0000-4000-8000-000000000001';const input={userId:id,organizationId:id,role:'investor',label:'investor-demo',email:'fixture@example.test',active:'no',revision:'0',note:'Verified fictional authorization',confirm:'on'};
const req=(body:unknown,origin='https://site.example')=>new Request('https://site.example/api/admin/live-access',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc}});m.live.mockResolvedValue({context:{role:'sales'},client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:1,error:null});});
it('requires admin MFA and same origin, with no admin role escalation accepted',async()=>{
 expect((await manage(req(input,'https://evil.example'))).status).toBe(403);expect(m.guard).not.toHaveBeenCalled();expect((await manage(req({...input,role:'admin'}))).status).toBe(400);m.guard.mockResolvedValue({role:'operator'});expect((await manage(req(input))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('binds the exact verified user/email/org with an expected revision and reports conflicts',async()=>{
 expect((await manage(req(input))).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('set_live_account_access',expect.objectContaining({p_user:id,p_org:id,p_email:'fixture@example.test',p_active:false,p_revision:0}));m.rpc.mockResolvedValue({error:{code:'40001',message:'PRIVATE'}});const r=await manage(req(input));expect(r.status).toBe(409);expect(await r.text()).not.toContain('PRIVATE');
});
it('rejects investor/customer writes and does not accept an organization override in sales requests',async()=>{
 const body={requestId:id,revision:1,status:'active',note:'Real follow-up fixture'};for(const role of ['investor','client']){m.live.mockResolvedValue({context:{role},client:{rpc:m.rpc}});expect((await followup(req(body))).status).toBe(403);}expect((await followup(req({...body,organizationId:id}))).status).toBe(400);expect(m.rpc).not.toHaveBeenCalled();
});

it('reports only known account validation reasons without exposing arbitrary database errors',async()=>{for(const [message,error,status] of [['Verified email user required','account_email_unverified',400],['Dedicated scoped identity required','account_conflicting_grants',400],['Account scope is immutable','account_scope_locked',400],['Stale account revision','account_revision_conflict',409]] as const){m.rpc.mockResolvedValue({error:{code:'22023',message}});const r=await manage(req(input));expect(r.status).toBe(status);expect(await r.json()).toEqual({error});}});
