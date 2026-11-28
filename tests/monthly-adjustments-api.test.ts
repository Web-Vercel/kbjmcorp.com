import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),testOrg:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:vi.fn()}));vi.mock('@/lib/collections/test-mode',()=>({collectionTestOrganization:m.testOrg}));
import {POST} from '@/app/api/admin/monthly-adjustments/route';
const id='b0000000-0000-4000-8000-000000000001';
function req(body:unknown,origin='https://site.test'){return new Request('https://site.test/api/admin/monthly-adjustments',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:id,error:null});m.testOrg.mockReturnValue(id);});
it('requires same-origin financial consent and leaves monetary amounts to SQL',async()=>{expect((await POST(req({action:'publish',draftId:id}))).status).toBe(400);expect((await POST(req({action:'publish',draftId:id,confirm:'on'},'https://evil.test'))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();expect((await POST(req({action:'publish',draftId:id,confirm:'on',amountMinor:'1'}))).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('publish_monthly_adjustment',{p_draft:id,p_test_org:id});});
it('does not report uncertain publication as success',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'LOST RESPONSE'}});const r=await POST(req({action:'publish',draftId:id,confirm:'on'}));expect(r.status).toBe(503);expect((await r.json()).ok).not.toBe(true);});
it('passes original evidence and idempotent request key for draft preparation',async()=>{await POST(req({action:'prepare',differenceId:id,requestId:id,reference:'FICTIONAL SOURCE CHECK',confirm:'on'}));expect(m.rpc).toHaveBeenCalledWith('prepare_monthly_adjustment',{p_difference:id,p_request:id,p_reference:'FICTIONAL SOURCE CHECK'});});
