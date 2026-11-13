import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return{getStaffContext:m.guard,staffError:(r:{error:string;status:number})=>authResponse({error:r.error},r.status)};});
import {GET} from '@/app/api/admin/fx-reference/route';
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',m.fetch);m.guard.mockResolvedValue({role:'admin'});});
afterEach(()=>vi.unstubAllGlobals());
it('denies non-admins before calling the remote source',async()=>{m.guard.mockResolvedValue({role:'operator'});expect((await GET()).status).toBe(403);expect(m.fetch).not.toHaveBeenCalled();});
it('uses a fixed source and explicit dated inversion',async()=>{m.fetch.mockResolvedValue(new Response(JSON.stringify({observations:[{d:new Date().toISOString().slice(0,10),FXCNYCAD:{v:'0.2'}}]})));const r=await GET();expect(r.status).toBe(200);expect((await r.json()).reference.rate).toBe('5.00000000');expect(m.fetch.mock.calls[0][0]).toBe('https://www.bankofcanada.ca/valet/observations/FXCNYCAD/json?recent=1');});
it('returns unavailable without a fabricated rate after remote failure',async()=>{m.fetch.mockRejectedValue(new Error('private details'));const r=await GET();expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'reference_unavailable'});});
