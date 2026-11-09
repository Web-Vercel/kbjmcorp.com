import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return {getStaffContext:m.guard,staffError:(s:{error:string;status:number})=>authResponse({error:s.error},s.status)};});
import {POST} from '@/app/api/monthly-settlements/route';
const id='b0000000-0000-4000-8000-000000000001';
function request(body:unknown,origin='https://site.example'){return new Request('https://site.example/api/monthly-settlements',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({role:'operator',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:id,error:null});});
it('passes source/quote identifiers, not browser-calculated amounts, to the scoped preparation RPC',async()=>{
 const r=await POST(request({action:'prepare',snapshotId:id,quoteId:id,agreement:'Agreement reference',note:'Preparation note',confirm:'on',total:'999999',rate:'forged'}));expect(r.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('prepare_monthly_settlement',{p_snapshot:id,p_quote:id,p_agreement:'Agreement reference',p_note:'Preparation note'});
});
it('requires same-origin confirmation and staff MFA before writes',async()=>{
 const body={action:'review',draftId:id,decision:'approved',note:'Reviewed note',confirm:'on'};
 expect((await POST(request(body,'https://evil.example'))).status).toBe(403);expect(m.guard).not.toHaveBeenCalled();expect((await POST(request({...body,confirm:undefined}))).status).toBe(400);
 m.guard.mockResolvedValue({error:'mfa_required',status:403});expect((await POST(request(body))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('maps blocked source and concurrent review errors without exposing database details',async()=>{
 const body={action:'review',draftId:id,decision:'approved',note:'Reviewed note',confirm:'on'};
 m.rpc.mockResolvedValueOnce({error:{code:'40001',message:'PRIVATE DETAIL'}});const r=await POST(request(body));expect(r.status).toBe(409);expect(await r.text()).not.toContain('PRIVATE');
 m.rpc.mockResolvedValueOnce({error:{code:'23514'}});expect((await POST(request(body))).status).toBe(400);
});
