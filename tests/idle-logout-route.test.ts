import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),getUser:vi.fn(),signOut:vi.fn()}));
vi.mock('@/lib/auth/server',()=>({authClient:mocks.client}));
import {POST} from '@/app/api/auth/logout/route';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function request(body:object){return new Request('http://localhost/api/auth/logout',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();mocks.client.mockResolvedValue({auth:{getUser:mocks.getUser,signOut:mocks.signOut}});mocks.getUser.mockResolvedValue({data:{user:{id:a}},error:null});mocks.signOut.mockResolvedValue({error:null});});
it('refuses an inactivity logout from another account even if cookies changed between requests',async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:b}},error:null});expect((await POST(request({expectedUserId:a}))).status).toBe(409);expect(mocks.signOut).not.toHaveBeenCalled();});
it('signs out only the matching local session',async()=>{expect((await POST(request({expectedUserId:a}))).status).toBe(200);expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});});
it('preserves existing explicit logout requests',async()=>{expect((await POST(request({}))).status).toBe(200);expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'});});
it('does not claim success when sign-out fails',async()=>{mocks.signOut.mockResolvedValue({error:Error('unavailable')});expect((await POST(request({expectedUserId:a}))).status).toBe(502);});
