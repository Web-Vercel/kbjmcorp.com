import {beforeEach,it,expect,vi} from 'vitest';
import {buildQuoteSnapshot} from '@/lib/billing/quote-snapshot';
import {checkedPublicationQuote} from '@/lib/billing/publication';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return {getStaffContext:m.guard,staffError:(s:{error:string;status:number})=>authResponse({error:s.error},s.status)};});
import {POST} from '@/app/api/admin/monthly-publications/route';
const id='b0000000-0000-4000-8000-000000000001';
const rule={mode:'percentage' as const,basis:'platform_ad_spend' as const,basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
const quote=buildQuoteSnapshot({requestId:id,organizationId:id,period:'2024-01-01',sourceCadMinor:'10001',rateMode:'manual',rate:'5',canada:rule,china:rule,transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},costUnit:'zhidian_cn',note:'Fee agreement verified'});
const body={draftId:id,summary:'本月广告及服务费用',confirm:'on'};
const req=(origin='https://site.example',payload:unknown=body)=>new Request('https://site.example/api/admin/monthly-publications',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc}});m.rpc.mockImplementation((name:string)=>Promise.resolve(name==='get_monthly_publication_input'?{data:{quote_id:id,organization_id:id,period:'2024-01-01',private_snapshot:quote},error:null}:{data:id,error:null}));});
it('recalculates historical quote math and blocks tampered totals before any ledger RPC',async()=>{
 expect(checkedPublicationQuote(quote,{id,organizationId:id,period:'2024-01-01'})).toBe(quote);
 expect(()=>checkedPublicationQuote({...quote,upstreamCnyMinor:'1'},{id,organizationId:id,period:'2024-01-01'})).toThrow();
 m.rpc.mockResolvedValue({data:{quote_id:id,organization_id:id,period:'2024-01-01',private_snapshot:{...quote,finalMinor:'1'}},error:null});const r=await POST(req());expect(r.status).toBe(400);expect((await r.json()).error).toBe('invalid_quote');expect(m.rpc).toHaveBeenCalledTimes(1);
});
it('requires admin MFA and same-origin confirmation, ignoring browser money inputs',async()=>{
 expect((await POST(req('https://evil.example'))).status).toBe(403);expect(m.guard).not.toHaveBeenCalled();m.guard.mockResolvedValueOnce({role:'operator'});expect((await POST(req())).status).toBe(403);m.guard.mockResolvedValueOnce({error:'mfa_required',status:403});expect((await POST(req())).status).toBe(403);
 expect((await POST(req('https://site.example',{...body,amount:'1',rate:'999'}))).status).toBe(200);expect(m.rpc).toHaveBeenLastCalledWith('publish_monthly_statement',{p_draft:id,p_summary:body.summary,p_expected:quote});
});
it('reports insufficient funds and duplicate account months without leaking private errors',async()=>{
 for(const [code,error] of [['P0003','insufficient_balance'],['23505','already_posted']]){
 m.rpc.mockImplementation((name:string)=>Promise.resolve(name==='get_monthly_publication_input'?{data:{quote_id:id,organization_id:id,period:'2024-01-01',private_snapshot:quote},error:null}:{error:{code,message:'PRIVATE SECRET'}}));const r=await POST(req());expect((await r.json()).error).toBe(error);
 }
});

it('does not report success for an invalid publication receipt even after the write RPC returns',async()=>{
 m.rpc.mockImplementation((name:string)=>Promise.resolve(name==='get_monthly_publication_input'?{data:{quote_id:id,organization_id:id,period:'2024-01-01',private_snapshot:quote},error:null}:{data:'not-a-receipt-id',error:null}));const response=await POST(req());expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'unavailable'});
});

it('confirms the original draft and server-derived company/month without exposing private pricing',async()=>{
 const r=await POST(req());expect(await r.json()).toEqual({ok:true,id,draftId:id,organizationId:id,period:'2024-01-01'});
});
