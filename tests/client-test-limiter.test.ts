import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/auth/config',()=>({getRateLimitConfig:()=>({url:'https://fixture.example',serviceKey:'fixture-server-key',rateSecret:'fixture-hmac-key-at-least-32-characters'})}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:mocks.rpc})}));
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
it('applies persistent per-identity and global limits without sending plain email identifiers to the limiter',async()=>{mocks.rpc.mockResolvedValue({data:0,error:null});expect(await consumeAuthLimit('client@example.test','client_test')).toBe(0);const args=mocks.rpc.mock.calls[0][1];expect(args.p_limits).toEqual([5,100]);expect(args.p_windows).toEqual([600,600]);expect(args.p_keys[0]).toMatch(/^client_test:[0-9a-f]{64}$/);expect(args.p_keys[1]).toBe('client_test:global');expect(JSON.stringify(args)).not.toContain('client@example.test');mocks.rpc.mockResolvedValue({data:null,error:{code:'unavailable'}});await expect(consumeAuthLimit('client@example.test','client_test')).rejects.toThrow('unavailable');});
