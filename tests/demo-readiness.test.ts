import {afterEach,it,expect,vi} from 'vitest';
import {demoReadiness} from '@/lib/demo/session';
afterEach(()=>vi.unstubAllEnvs());
it('distinguishes missing variables, disabled access and malformed or encoded account arrays without leaking values',()=>{
 vi.stubEnv('DEMO_LOGIN_ENABLED','');vi.stubEnv('DEMO_SESSION_SECRET','');vi.stubEnv('DEMO_ACCOUNTS_JSON','');expect(demoReadiness()).toEqual({DEMO_LOGIN_ENABLED:'missing',DEMO_SESSION_SECRET:'missing',DEMO_ACCOUNTS_JSON:'missing'});
 vi.stubEnv('DEMO_LOGIN_ENABLED','false');vi.stubEnv('DEMO_SESSION_SECRET','short-secret');vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify('[{"PRIVATE":"DATA"}]'));expect(demoReadiness()).toEqual({DEMO_LOGIN_ENABLED:'disabled',DEMO_SESSION_SECRET:'invalid',DEMO_ACCOUNTS_JSON:'encoded'});
 vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify({DEMO_ACCOUNTS_JSON:'PRIVATE'}));expect(demoReadiness().DEMO_ACCOUNTS_JSON).toBe('wrong_shape');vi.stubEnv('DEMO_ACCOUNTS_JSON','not JSON PRIVATE');expect(demoReadiness().DEMO_ACCOUNTS_JSON).toBe('invalid');expect(JSON.stringify(demoReadiness())).not.toContain('PRIVATE');
});
