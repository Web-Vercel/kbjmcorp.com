import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({client:vi.fn(),user:vi.fn(),rpc:vi.fn(),mfa:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('@/lib/auth/server',()=>({authClient:m.client}));
import {getLiveContext} from '@/lib/live-access/server';
const id='d0000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.clearAllMocks();m.client.mockResolvedValue({auth:{getUser:m.user,mfa:{getAuthenticatorAssuranceLevel:m.mfa}},rpc:m.rpc});m.user.mockResolvedValue({data:{user:{id}}});m.mfa.mockResolvedValue({data:{currentLevel:'aal1'}});});
it('skips MFA only after the database validates the agent identity',async()=>{m.rpc.mockResolvedValue({data:{user_id:id,organization_id:id,organization_name:'Agent portal',role:'agent',label:'Agent',revision:1}});expect((await getLiveContext())).toHaveProperty('context.role','agent');expect(m.mfa).not.toHaveBeenCalled();m.rpc.mockResolvedValue({error:{code:'42501'}});expect(await getLiveContext()).toMatchObject({error:'forbidden'});});
it('keeps investors and sales behind MFA',async()=>{for(const role of ['investor','sales']){m.rpc.mockResolvedValue({data:{user_id:id,organization_id:id,organization_name:'Company',role,label:'Fixture',revision:1}});expect(await getLiveContext()).toMatchObject({error:'mfa_required'});}});

it('accepts a database-validated client without MFA',async()=>{m.rpc.mockResolvedValue({data:{user_id:id,organization_id:id,organization_name:'Company',role:'client',label:'Client',revision:1}});expect(await getLiveContext()).toHaveProperty('context.role','client');expect(m.mfa).not.toHaveBeenCalled();});
