import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({client:vi.fn(),user:vi.fn()}));vi.mock('@/lib/auth/server',()=>({authClient:m.client}));
import {GET} from '@/app/api/auth/session-identity/route';
beforeEach(()=>{vi.clearAllMocks();m.client.mockResolvedValue({auth:{getUser:m.user}});});
it('returns only current verified identity with no-store and never session tokens or requested user data',async()=>{m.user.mockResolvedValue({data:{user:{id:'verified-A',email:'a@example.test',app_metadata:{private:'SECRET'}}}});const r=await GET();expect(await r.json()).toEqual({userId:'verified-A',email:'a@example.test'});expect(r.headers.get('cache-control')).toContain('no-store');});
it('distinguishes missing login from unavailable verification without inventing an identity',async()=>{m.user.mockResolvedValue({error:{message:'PRIVATE'},data:{user:null}});expect((await GET()).status).toBe(401);m.user.mockRejectedValue(Error('PRIVATE'));const r=await GET();expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE');});
