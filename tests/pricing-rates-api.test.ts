import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),insert:vi.fn(),select:vi.fn(),single:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:vi.fn()}));
import {POST} from '@/app/api/admin/pricing-rates/route';
const id='b0000000-0000-4000-8000-000000000001';
function req(){return new Request('https://site.example/api/admin/pricing-rates',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({organizationId:id,month:'2026-10',canada:'',china:'',transfer:'0'})});}
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({role:'admin',client:{from:()=>({insert:m.insert})}});m.insert.mockReturnValue({select:m.select});m.select.mockReturnValue({single:m.single});m.single.mockResolvedValue({data:{revision:4,organization_id:id,effective_month:'2026-10-01',canada_bps:null,china_bps:null,transfer_bps:0},error:null});});
it('returns the saved version and preserves zero versus inherited null values',async()=>{const r=await POST(req());expect(r.status).toBe(200);expect(await r.json()).toMatchObject({ok:true,saved:{revision:4,transfer_bps:0}});expect(m.insert).toHaveBeenCalledWith({organization_id:id,effective_month:'2026-10-01',canada_bps:null,china_bps:null,transfer_bps:0});});
it('does not claim success for an unreadable or mismatched saved row',async()=>{m.single.mockResolvedValue({data:{revision:4,organization_id:id,effective_month:'2026-10-01',canada_bps:null,china_bps:null,transfer_bps:500},error:null});expect((await POST(req())).status).toBe(502);});
it('preserves administrator-only writes',async()=>{m.guard.mockResolvedValue({role:'operator'});expect((await POST(req())).status).toBe(403);expect(m.insert).not.toHaveBeenCalled();});
