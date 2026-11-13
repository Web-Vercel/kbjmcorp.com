import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),ref:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return{getStaffContext:m.guard,staffError:(r:{error:string;status:number})=>authResponse({error:r.error},r.status)};});
vi.mock('@/lib/billing/boc-fetch',()=>({fetchBocReference:m.ref}));
import {POST} from '@/app/api/admin/quote-drafts/route';
const rule={mode:'percentage',basis:'platform_ad_spend',basisPoints:1000,fixedMinor:'0',minimumMinor:'0',waiveWhenZero:true};
const data={requestId:'a0000000-0000-4000-8000-000000000001',organizationId:'b0000000-0000-4000-8000-000000000001',period:'2026-11-01',sourceCadMinor:'100000',rateMode:'manual',rate:'5.2',canada:rule,china:{...rule,mode:'fixed',fixedMinor:'58000'},transfer:{mode:'none',basisPoints:0,fixedMinor:'0',bearer:'agency',includedInRate:false},note:'FICTIONAL quote'};
const req=(patch:object={})=>new Request('https://site.example/api/admin/quote-drafts',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({...data,...patch})});
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:'d0000000-0000-4000-8000-000000000001',error:null});});
it('recomputes totals and ignores forged browser totals and status',async()=>{expect((await POST(req({finalMinor:'1',status:'approved',created_by:'forged'}))).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('save_agency_quote_revision',expect.objectContaining({p_snapshot:expect.objectContaining({finalMinor:'630000',status:'draft'})}));});
it('rejects finance operators before writing or fetching rates',async()=>{m.guard.mockResolvedValue({role:'operator'});expect((await POST(req())).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();expect(m.ref).not.toHaveBeenCalled();});
it('refuses a changed automatic rate instead of saving a different quote silently',async()=>{m.ref.mockResolvedValue({rate:'5.30000000',date:'2026-11-06'});expect((await POST(req({rateMode:'automatic',rate:'5.20000000',referenceDate:'2026-11-06'}))).status).toBe(409);expect(m.rpc).not.toHaveBeenCalled();});
it('does not downgrade a failed automatic lookup to manual input',async()=>{m.ref.mockRejectedValue(new Error('private'));expect((await POST(req({rateMode:'automatic',referenceDate:'2026-11-06'}))).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled();});
it('does not confirm a missing or malformed saved quote identifier',async()=>{
 for(const value of [null,'bad',{id:'d0000000-0000-4000-8000-000000000001'}]){m.rpc.mockResolvedValueOnce({data:value,error:null});const r=await POST(req());expect(r.status).toBe(502);expect(await r.json()).toEqual({error:'quote_unconfirmed'});}
});
