import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:vi.fn()}));
import {POST} from '@/app/api/admin/monthly-automation/route';
const id='b0000000-0000-4000-8000-000000000001';
function request(firstMonth?:string){return new Request('https://site.example/api/admin/monthly-automation',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({bindingId:id,enabled:'yes',agreement:'FICTIONAL TEST AGREEMENT',confirm:'on',firstMonth})});}
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:1,error:null});});
it('requires an explicit valid month and sends the exact first day to the scoped database function',async()=>{
 for(const value of [undefined,'','2026-13','2026-11-15'])expect((await POST(request(value))).status).toBe(400);
 expect(m.rpc).not.toHaveBeenCalled();expect((await POST(request('2026-11'))).status).toBe(200);
 expect(m.rpc).toHaveBeenCalledWith('configure_monthly_automation',{p_binding:id,p_enabled:true,p_agreement:'FICTIONAL TEST AGREEMENT',p_first_month:'2026-11-01'});
});
it('retains administrator-only authorization and reports migration or storage failures honestly',async()=>{
 m.guard.mockResolvedValueOnce({role:'operator'});expect((await POST(request('2026-11'))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
 m.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});expect((await POST(request('2026-11'))).status).toBe(503);
});
