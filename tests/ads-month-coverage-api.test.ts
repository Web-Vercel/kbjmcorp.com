import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return {getStaffContext:m.guard,staffError:(s:{error:string;status:number})=>authResponse({error:s.error},s.status)};});
import {POST} from '@/app/api/ads-month-coverage/route';
const id='b0000000-0000-4000-8000-000000000001';
const body={action:'submit',snapshotId:id,requestId:id,kind:'zero',amount:'0.000000',impressions:'0',clicks:'0',evidence:'Official report reference',hash:'a'.repeat(64),note:'Full month and missing dates verified',confirm:'on'};
const req=(payload:unknown=body,origin='https://site.example')=>new Request('https://site.example/api/ads-month-coverage',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({role:'operator',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:id,error:null});});
it('passes exact amounts and evidence to the scoped RPC, with no automatic approval',async()=>{
 expect((await POST(req())).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('submit_ads_month_coverage',{p_snapshot:id,p_request:id,p_kind:'zero',p_amount:'0',p_impressions:'0',p_clicks:'0',p_evidence:body.evidence,p_hash:body.hash,p_active_from:null,p_note:body.note});expect(m.rpc).toHaveBeenCalledTimes(1);
});
it('requires same-origin confirmation, a file fingerprint, and staff MFA',async()=>{
 expect((await POST(req(body,'https://evil.example'))).status).toBe(403);expect(m.guard).not.toHaveBeenCalled();expect((await POST(req({...body,hash:''}))).status).toBe(400);expect((await POST(req({...body,confirm:undefined}))).status).toBe(400);m.guard.mockResolvedValue({error:'mfa_required',status:403});expect((await POST(req())).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('returns a bounded discrepancy response without raw source data',async()=>{
 m.rpc.mockResolvedValue({error:{code:'23514',message:'PRIVATE SOURCE BODY'}});const r=await POST(req());expect(r.status).toBe(400);expect(await r.json()).toEqual({error:'coverage_difference'});
});
