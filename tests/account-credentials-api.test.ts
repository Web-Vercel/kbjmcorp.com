import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),config:vi.fn(),limit:vi.fn(),begin:vi.fn(),finish:vi.fn(),update:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:(e:{error:string;status:number})=>new Response(JSON.stringify({error:e.error}),{status:e.status})}));
vi.mock('@/lib/auth/privileged-config',()=>({getPrivilegedConnection:m.config}));vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:m.limit}));vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{admin:{updateUserById:m.update}},rpc:m.finish})}));
import {POST} from '@/app/api/admin/account-credentials/route';
const actor='ac000000-0000-4000-8000-000000000001',target='ac000000-0000-4000-8000-000000000002',op='ac000000-0000-4000-8000-000000000003';
const body={action:'password',requestId:op,userId:target,expectedEmail:'client@example.test',password:'FICTIONAL-NEW-PASSWORD-42',reason:'Verified holder request',confirm:'on'};
const req=(b:unknown=body,origin='https://site.example')=>new Request('https://site.example/api/admin/account-credentials',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(b)});
beforeEach(()=>{vi.clearAllMocks();m.config.mockReturnValue({url:'https://fixture.supabase.test',key:'FIXTURE-SERVICE-SECRET'});m.limit.mockResolvedValue(0);m.begin.mockResolvedValue({data:op,error:null});m.finish.mockResolvedValue({data:{status:'succeeded'},error:null});m.update.mockResolvedValue({data:{user:{id:target}},error:null});const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{id:op,target_id:target},error:null})};m.from.mockReturnValue(q);m.guard.mockResolvedValue({user:{id:actor},role:'admin',client:{rpc:m.begin,from:m.from}});});
it('requires same origin, administrator MFA guard, confirmation and strong input before mutation',async()=>{
 expect((await POST(req(body,'https://other.example'))).status).toBe(403);expect((await POST(req({...body,password:'short'}))).status).toBe(400);expect((await POST(req({...body,confirm:undefined}))).status).toBe(400);
 m.guard.mockResolvedValue({error:'mfa_required',status:403});expect((await POST(req())).status).toBe(403);m.guard.mockResolvedValue({role:'operator',user:{id:actor}});expect((await POST(req())).status).toBe(403);expect(m.update).not.toHaveBeenCalled();
});
it('rejects self maintenance and stops before Auth when migration or target state is unavailable',async()=>{
 expect((await POST(req({...body,userId:actor}))).status).toBe(400);m.begin.mockResolvedValue({error:{code:'PGRST202'}});expect(await(await POST(req())).json()).toEqual({error:'setup_required'});expect(m.update).not.toHaveBeenCalled();
});
it('audits and locks before resetting only the selected user password, then finalizes without returning it',async()=>{
 const r=await POST(req());expect(r.status).toBe(200);expect(m.begin).toHaveBeenCalledWith('begin_account_credential_change',expect.objectContaining({p_target:target,p_action:'password',p_new_email:null}));expect(m.update).toHaveBeenCalledWith(target,{password:body.password});expect(m.finish).toHaveBeenCalledWith('finish_account_credential_change',{p_id:op,p_result:'succeeded',p_actor:actor});expect(await r.text()).not.toContain(body.password);expect(m.begin.mock.invocationCallOrder[0]).toBeLessThan(m.update.mock.invocationCallOrder[0]);
});
it('requires verified mailbox authorization and sends only email fields to Auth',async()=>{
 const email={...body,action:'email',email:'new@example.test',password:undefined};expect((await POST(req(email))).status).toBe(400);expect((await POST(req({...email,emailVerified:'on'}))).status).toBe(200);expect(m.update).toHaveBeenCalledWith(target,{email:'new@example.test',email_confirm:true});
});
it('never retries uncertain Auth writes and keeps the target locked for reconciliation',async()=>{
 m.update.mockRejectedValue(Error('PRIVATE timeout'));m.finish.mockResolvedValue({data:{status:'uncertain'}});const r=await POST(req());expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'maintenance_uncertain',operationId:op});expect(m.update).toHaveBeenCalledTimes(1);expect(m.finish).toHaveBeenCalledWith('finish_account_credential_change',{p_id:op,p_result:'uncertain',p_actor:actor});
});
it('clears maintenance after a definitive password policy failure without leaking messages',async()=>{
 m.update.mockResolvedValue({error:{code:'weak_password',message:'PRIVATE'},data:{}});m.finish.mockResolvedValue({data:{status:'failed'}});const r=await POST(req());expect(r.status).toBe(400);expect(await r.json()).toEqual({error:'weak_password',operationId:op});
});
it('does not claim success if business email repinning cannot finish',async()=>{
 m.finish.mockResolvedValue({error:{code:'FAIL'}});const r=await POST(req());expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'maintenance_uncertain',operationId:op});
});
it('reconciles a visible target operation without performing another Auth write',async()=>{
 m.finish.mockResolvedValue({data:{status:'reconciled'}});const r=await POST(req({action:'reconcile',operationId:op,userId:target,confirm:'on'}));expect(await r.json()).toEqual({ok:true,status:'reconciled'});expect(m.update).not.toHaveBeenCalled();expect(m.begin).not.toHaveBeenCalled();
});
