import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {mfaDeadline} from '@/lib/auth/mfa-window';
const m=vi.hoisted(()=>({context:vi.fn(),assurance:vi.fn(),factors:vi.fn(),signOut:vi.fn(),verify:vi.fn(),enroll:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.context}));
vi.mock('@/lib/live-access/server',()=>({getLiveContext:m.context}));
vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:async()=>0}));
import {POST} from '@/app/api/auth/mfa-window/route';
import {POST as staffMfa} from '@/app/api/admin/mfa/route';
import {POST as accessMfa} from '@/app/api/access/mfa/route';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const factor='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const now=Date.parse('2026-11-20T18:00:00Z');
function request(body:unknown){return new Request('https://site.example/api/auth/mfa-window',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify(body)});}
function context(age=0,role='investor'){return {user:{id,last_sign_in_at:new Date(now-age).toISOString()},context:{role},client:{auth:{signOut:m.signOut,mfa:{getAuthenticatorAssuranceLevel:m.assurance,listFactors:m.factors,challengeAndVerify:m.verify,enroll:m.enroll}}}};}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.resetAllMocks();m.context.mockResolvedValue(context());m.assurance.mockResolvedValue({data:{currentLevel:'aal1'},error:null});m.factors.mockResolvedValue({data:{totp:[{id:factor,status:'verified'}],all:[{id:factor,status:'verified',factor_type:'totp'}]},error:null});m.signOut.mockResolvedValue({error:null});m.verify.mockResolvedValue({error:null});});
afterEach(()=>vi.useRealTimers());
it('anchors five-minute verification and ten-minute initial setup to sign-in, failing closed without an anchor',()=>{expect(mfaDeadline(new Date(now).toISOString(),true)).toBe(now+300000);expect(mfaDeadline(new Date(now).toISOString(),false)).toBe(now+600000);expect(mfaDeadline(undefined,true)).toBeNull();expect(mfaDeadline('invalid',false)).toBeNull();});
it('does not extend the deadline when the page checks again',async()=>{m.context.mockResolvedValue(context(120000));const body={portal:'admin',expectedUserId:id};expect((await (await POST(request(body))).json()).deadline).toBe(now+180000);vi.setSystemTime(now+60000);expect((await (await POST(request(body))).json()).deadline).toBe(now+180000);expect(m.signOut).not.toHaveBeenCalled();});
it('ends an expired pending session locally',async()=>{m.context.mockResolvedValue(context(300000));expect(await (await POST(request({portal:'admin',expectedUserId:id}))).json()).toEqual({expired:true});expect(m.signOut).toHaveBeenCalledWith({scope:'local'});});
it('does not sign out a different current identity',async()=>{expect((await POST(request({portal:'admin',expectedUserId:factor}))).status).toBe(409);expect(m.signOut).not.toHaveBeenCalled();});
it('does not sign out a session verified in another tab',async()=>{m.context.mockResolvedValue(context(600000));m.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null});expect(await (await POST(request({portal:'admin',expectedUserId:id}))).json()).toEqual({complete:true});expect(m.signOut).not.toHaveBeenCalled();});
it('reports an unconfirmed logout as a failure',async()=>{m.context.mockResolvedValue(context(600000));m.signOut.mockResolvedValue({error:new Error('offline')});expect((await POST(request({portal:'access',expectedUserId:id}))).status).toBe(502);});
it('leaves clients without mandatory MFA outside the pending-MFA timer',async()=>{m.context.mockResolvedValue(context(600000,'client'));expect(await (await POST(request({portal:'access',expectedUserId:id}))).json()).toEqual({complete:true});expect(m.signOut).not.toHaveBeenCalled();});
for(const [name,route] of [['staff',staffMfa],['external',accessMfa]] as const){
 it(`${name}: rejects expired verification before contacting the provider`,async()=>{m.context.mockResolvedValue(context(300000));expect((await route(request({action:'verify',factorId:factor,code:'123456',expectedUserId:id}))).status).toBe(408);expect(m.verify).not.toHaveBeenCalled();});
 it(`${name}: rejects a stale account's MFA action`,async()=>{expect((await route(request({action:'enroll',expectedUserId:factor}))).status).toBe(409);expect(m.enroll).not.toHaveBeenCalled();});
 it(`${name}: revokes a verification that completes past the deadline`,async()=>{m.context.mockResolvedValue(context(299999));m.verify.mockImplementation(async()=>{vi.setSystemTime(now+2);return {error:null};});expect((await route(request({action:'verify',factorId:factor,code:'123456'}))).status).toBe(408);expect(m.signOut).toHaveBeenCalledWith({scope:'local'});});
}
