import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return {getStaffContext:m.guard,staffError:(s:{error:string;status:number})=>authResponse({error:s.error},s.status)};});
import {POST} from '@/app/api/upstream-payments/route';
const id='b0000000-0000-4000-8000-000000000001';
const input={action:'submit',requestId:id,organizationId:id,bankReference:'FICTIONAL-123',receivedOn:'2026-10-31',received:'100.01',evidence:'FICTIONAL DOCUMENT',hash:'a'.repeat(64),note:'Verified original bank receipt',allocations:[{statementId:id,amount:'100.01'}],confirm:'on'};
const req=(body:unknown,origin='https://site.example')=>new Request('https://site.example/api/upstream-payments',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({role:'operator',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:id,error:null});});
it('converts CAD decimals exactly and forwards only explicit allocation fields',async()=>{const r=await POST(req({...input,role:'admin',verified:true,rate:'PRIVATE'}));expect(r.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('submit_upstream_payment',expect.objectContaining({p_received:'10001',p_allocations:[{statementId:id,amountMinor:'10001'}]}));expect(JSON.stringify(m.rpc.mock.calls)).not.toContain('PRIVATE');});
it('rejects cross-origin requests, missing confirmation, zero amounts and sessions without MFA before RPC',async()=>{expect((await POST(req(input,'https://evil.example'))).status).toBe(403);expect(m.guard).not.toHaveBeenCalled();expect((await POST(req({...input,confirm:''}))).status).toBe(400);expect((await POST(req({...input,received:'0'}))).status).toBe(400);m.guard.mockResolvedValueOnce({error:'mfa_required',status:403});expect((await POST(req(input))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();});
it('exposes bounded errors and refuses unconfirmed submit success',async()=>{m.rpc.mockResolvedValueOnce({data:null,error:{code:'23514',message:'PRIVATE'}});const r=await POST(req(input));expect(r.status).toBe(400);expect(await r.json()).toEqual({error:'upstream_excess'});m.rpc.mockResolvedValueOnce({data:null,error:null});expect((await POST(req(input))).status).toBe(502);});
it('reviews the original record without browser-provided totals or statement substitutions',async()=>{await POST(req({action:'review',paymentId:id,decision:'approved',note:'Independent bank verification',confirm:'on',received:'99999'}));expect(m.rpc).toHaveBeenCalledWith('review_upstream_payment',{p_payment:id,p_decision:'approved',p_note:'Independent bank verification'});});

it('submits and reviews whole-batch reversals without trusting browser amounts',async()=>{
 expect((await POST(req({action:'reversal_submit',paymentId:id,requestId:id,reason:'Correct allocation evidence',evidence:'CONTROLLED ORIGINAL',hash:'b'.repeat(64),amount:'-99999',confirm:'on'}))).status).toBe(200);
 expect(m.rpc).toHaveBeenLastCalledWith('submit_upstream_reversal',{p_payment:id,p_request:id,p_reason:'Correct allocation evidence',p_evidence:'CONTROLLED ORIGINAL',p_hash:'b'.repeat(64)});
 await POST(req({action:'reversal_review',reversalId:id,decision:'approved',note:'Independent correction review',confirm:'on'}));expect(m.rpc).toHaveBeenLastCalledWith('review_upstream_reversal',{p_reversal:id,p_decision:'approved',p_note:'Independent correction review'});
 m.rpc.mockResolvedValueOnce({data:null,error:{code:'23514',message:'PRIVATE'}});const failed=await POST(req({action:'reversal_submit',paymentId:id,requestId:id,reason:'Correct evidence',evidence:'CONTROLLED ORIGINAL',hash:'b'.repeat(64),confirm:'on'}));expect(await failed.json()).toEqual({error:'upstream_reversal_invalid'});
});
it('returns action-bound receipts and rejects malformed create IDs',async()=>{
 let r=await POST(req(input));expect((await r.json()).receipt).toEqual({id,action:'submit',stage:'registered',organizationId:id});
 r=await POST(req({action:'review',paymentId:id,decision:'approved',note:'Checked independent review',confirm:'on'}));expect((await r.json()).receipt).toEqual({id,action:'review',stage:'approved'});
 r=await POST(req({action:'reversal_submit',paymentId:id,requestId:id,reason:'Correct original allocation',evidence:'Original reversal record',hash:'b'.repeat(64),confirm:'on'}));expect((await r.json()).receipt).toEqual({id,action:'reversal_submit',stage:'registered',paymentId:id});
 for(const data of [null,'invalid',{id}]){m.rpc.mockResolvedValueOnce({data,error:null});expect((await POST(req(input))).status).toBe(502);}
});
