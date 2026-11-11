import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return{getStaffContext:m.guard,staffError:(r:{error:string;status:number})=>authResponse({error:r.error},r.status)};});
import {POST} from '@/app/api/admin/quote-archive/route';
const id='a0000000-0000-4000-8000-000000000001';
const req=(patch:object={})=>new Request('https://site.example/api/admin/quote-archive',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({id,archived:'yes',revision:0,note:'FICTIONAL archive',confirm:'on',...patch})});
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc}});m.rpc.mockResolvedValue({data:1,error:null});});
it('archives only through the protected lifecycle function with explicit confirmation',async()=>{expect((await POST(req())).status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('set_agency_quote_archived',{p_id:id,p_archived:true,p_revision:0,p_note:'FICTIONAL archive'});expect((await POST(req({confirm:''}))).status).toBe(400);});
it('denies finance operators before mutation',async()=>{m.guard.mockResolvedValue({role:'operator'});expect((await POST(req())).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();});
it('reports stale state without exposing internal data',async()=>{m.rpc.mockResolvedValue({error:{code:'40001',message:'private'}});const response=await POST(req());expect(response.status).toBe(409);expect(await response.text()).not.toContain('private');});
it('returns the confirmed target state and actual lifecycle revision, including already-achieved retries',async()=>{
 expect(await (await POST(req())).json()).toEqual({ok:true,receipt:{id,archived:true,stateRevision:1}});
 m.rpc.mockResolvedValue({data:3,error:null});expect(await (await POST(req({archived:'no',revision:1}))).json()).toEqual({ok:true,receipt:{id,archived:false,stateRevision:3}});
});
it('does not claim confirmation for malformed lifecycle revisions',async()=>{
 for(const data of [null,'1',-1,1.5,2147483648]){m.rpc.mockResolvedValueOnce({data,error:null});const r=await POST(req());expect(r.status).toBe(502);expect(await r.json()).toEqual({error:'archive_unconfirmed'});}
});
it('rejects cross-origin calls and out-of-range revisions before mutation',async()=>{
 const request=new Request('https://site.example/api/admin/quote-archive',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});expect((await POST(request)).status).toBe(403);expect((await POST(req({revision:2147483648}))).status).toBe(400);expect(m.rpc).not.toHaveBeenCalled();
});
