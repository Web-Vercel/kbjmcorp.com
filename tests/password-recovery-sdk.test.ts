import { afterEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({get:vi.fn(),set:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:m.get,set:m.set})}));
vi.mock('@/lib/auth/config',()=>({getStaffLoginConfig:()=>({url:'https://fixture.supabase.test',key:'fixture-public-key',rateSecret:'fixture-secret'.repeat(4)})}));
vi.mock('@/lib/auth/rate-limit',()=>({consumeAuthLimit:async()=>0}));
import {POST} from '@/app/api/auth/recovery/route';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('uses the real Supabase SDK to resume recovery, verify TOTP and update the password',async()=>{
 const id='a0000000-0000-4000-8000-000000000001',factor='b0000000-0000-4000-8000-000000000001',token='a'.repeat(64);
 const user={id,aud:'authenticated',role:'authenticated',email:'fixture@example.test',factors:[{id:factor,factor_type:'totp',status:'verified'}],app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
 const jwt=(aal:string)=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,aal})).toString('base64url')}.fixture`;
 const session=(aal:string)=>({access_token:jwt(aal),refresh_token:`fixture-refresh-${aal}`,expires_in:3600,token_type:'bearer',user});
 let revoked=false; const calls:string[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));const method=init?.method||'GET';calls.push(`${method} ${url.pathname}`);
  const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  if(url.pathname.endsWith('/verify')&&!url.pathname.includes('/factors/'))return json(session('aal1'));
  if(url.pathname.endsWith('/token')&&url.searchParams.get('grant_type')==='refresh_token')return revoked ? new Response(JSON.stringify({code:'refresh_token_not_found',message:'Invalid refresh token'}),{status:400,headers:{'content-type':'application/json'}}) : json(session('aal1'));
  if(url.pathname.endsWith('/user')&&method==='GET')return json(user);
  if(url.pathname.endsWith('/challenge'))return json({id:'fixture-challenge',type:'totp',expires_at:Math.floor(Date.now()/1000)+60});
  if(url.pathname.includes('/factors/')&&url.pathname.endsWith('/verify'))return json(session('aal2'));
  if(url.pathname.endsWith('/user')&&method==='PUT'){expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${jwt('aal2')}`);return json(user);}
  if(url.pathname.endsWith('/logout')){revoked=true;return new Response(null,{status:204});}
  throw Error(`Unexpected fixture request ${method} ${url.pathname}`);
 });vi.stubGlobal('fetch',fetcher);m.get.mockReturnValue(undefined);
 const request=(code?:string)=>new Request('https://site.example/api/auth/recovery',{method:'POST',headers:{origin:'https://site.example','content-type':'application/json'},body:JSON.stringify({action:'reset',token,password:'fixture-strong-password',code})});
 expect(await (await POST(request())).json()).toEqual({error:'mfa_required'});
 const cookie=m.set.mock.calls[0][1];expect(m.set.mock.calls[0][2]).toMatchObject({httpOnly:true,sameSite:'strict',path:'/api/auth/recovery'});m.get.mockReturnValue({value:cookie});
 const response=await POST(request('123456'));expect(await response.json()).toEqual({ok:true});
 expect(calls.filter(c=>c==='POST /auth/v1/verify')).toHaveLength(1);expect(calls).toContain('PUT /auth/v1/user');expect(m.set.mock.calls.at(-1)![2].maxAge).toBe(0);
 const before=calls.filter(c=>c==='PUT /auth/v1/user').length;expect(await(await POST(request('123456'))).json()).toEqual({error:'invalid_recovery'});expect(calls.filter(c=>c==='PUT /auth/v1/user')).toHaveLength(before);
});
