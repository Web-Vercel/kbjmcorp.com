import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),config:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:m.rpc})}));vi.mock('@/lib/auth/config',()=>({getRateLimitConfig:m.config}));
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
beforeEach(()=>{vi.clearAllMocks();m.config.mockReturnValue({url:'https://fictional.supabase.co',serviceKey:'FICTIONAL',rateSecret:'s'.repeat(40)});m.rpc.mockResolvedValue({data:0,error:null});});
it('uses separate persistent demo buckets without storing the username or weakening staff limits',async()=>{
 await consumeAuthLimit('fictional-demo','demo');expect(m.rpc).toHaveBeenCalledWith('consume_auth_limits',expect.objectContaining({p_limits:[5,100],p_windows:[600,600]}));const args=m.rpc.mock.calls[0][1];expect(args.p_keys[0]).toMatch(/^demo:[a-f0-9]{64}$/);expect(args.p_keys[1]).toBe('demo:global');expect(JSON.stringify(args)).not.toContain('fictional-demo');await consumeAuthLimit('staff@example.test','staff');expect(m.rpc.mock.calls[1][1].p_limits).toEqual([5,100]);
});
it('fails closed when the persistent limiter cannot be confirmed',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});await expect(consumeAuthLimit('fictional-demo','demo')).rejects.toThrow('Rate limiter unavailable');m.config.mockReturnValue(null);await expect(consumeAuthLimit('fictional-demo','demo')).rejects.toThrow('Auth unavailable');
});
