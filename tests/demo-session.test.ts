import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {scryptSync} from 'node:crypto';
import {demoConfig,demoLogin,demoSession} from '@/lib/demo/session';
const now=Date.parse('2026-11-10T12:00:00Z'),password='FICTIONAL-STRONG-DEMO-PASSWORD',salt='a'.repeat(32);
const accounts=['investor','client','sales'].map(role=>({username:role+'-demo',role,salt,passwordHash:scryptSync(password,salt,64).toString('hex'),expiresAt:'2026-11-11T12:00:00Z'}));
beforeEach(()=>{vi.stubEnv('DEMO_LOGIN_ENABLED','true');vi.stubEnv('DEMO_SESSION_SECRET','s'.repeat(40));vi.stubEnv('AUTH_RATE_LIMIT_SECRET','r'.repeat(40));vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify(accounts));});afterEach(()=>vi.unstubAllEnvs());
it('issues only the configured role and an eight-hour independent demo session',async()=>{
 for(const a of accounts){const result=await demoLogin(a.username,password,now);expect(result).not.toBeNull();expect(demoSession(result!.token,now)).toMatchObject({username:a.username,role:a.role,expires:now+8*3600000});expect(demoSession(result!.token,now+8*3600000)).toBeNull();}
});
it('rejects invalid credentials, disabled accounts and expired invitations',async()=>{
 expect(await demoLogin('unknown-demo',password,now)).toBeNull();expect(await demoLogin('investor-demo','wrong',now)).toBeNull();expect(await demoLogin('investor-demo',password,now+86400000)).toBeNull();vi.stubEnv('DEMO_LOGIN_ENABLED','false');expect(demoConfig()).toBeNull();
});
it('rejects forged, tampered or cross-role sessions and revokes on removal or credential changes',async()=>{
 const {token}= (await demoLogin('client-demo',password,now))!;const [body,signature]=token.split('.');const p=JSON.parse(Buffer.from(body,'base64url').toString());p.role='investor';expect(demoSession(Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+signature,now)).toBeNull();expect(demoSession(token+'.extra',now)).toBeNull();expect(demoSession('forged',now)).toBeNull();
 vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify(accounts.filter(a=>a.role!=='client')));expect(demoSession(token,now)).toBeNull();vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify(accounts.map(a=>({...a,passwordHash:'b'.repeat(128)}))));expect(demoSession(token,now)).toBeNull();
});
it('fails closed on malformed configuration, duplicate names and reused authentication secrets',()=>{
 for(const json of ['invalid',JSON.stringify([accounts[0],accounts[0]]),JSON.stringify([{...accounts[0],role:'admin'}]),JSON.stringify([{...accounts[0],passwordHash:'plain-password'}])]){vi.stubEnv('DEMO_ACCOUNTS_JSON',json);expect(demoConfig()).toBeNull();}vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify(accounts));vi.stubEnv('DEMO_SESSION_SECRET','r'.repeat(40));expect(demoConfig()).toBeNull();
});

it('limits training to assigned tracks, denies arbitrary tracks and revokes sessions when tracks change',async()=>{
 const training={...accounts[2],username:'training-demo',role:'training',trainingTracks:['finance_reviewer']};vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify([training]));const logged=(await demoLogin('training-demo',password,now))!;expect(demoSession(logged.token,now)).toMatchObject({role:'training',trainingTracks:['finance_reviewer']});vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify([{...training,trainingTracks:['sales']}]));expect(demoSession(logged.token,now)).toBeNull();
 for(const a of [{...training,trainingTracks:['admin']},{...training,role:'investor'},{...training,trainingTracks:['sales','sales']}]){vi.stubEnv('DEMO_ACCOUNTS_JSON',JSON.stringify([a]));expect(demoConfig()).toBeNull();}
});
