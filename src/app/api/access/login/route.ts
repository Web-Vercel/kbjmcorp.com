import {z} from 'zod';
import {authClient} from '@/lib/auth/server';
import {getStaffLoginConfig} from '@/lib/auth/config';
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {liveContext} from '@/lib/live-access/model';
export async function POST(request:Request){const input=await readAuthBody(request);if(input.error)return input.error;const p=z.object({email:z.email().max(254),password:z.string().min(1).max(256),captchaToken:z.string().min(1).max(4096)}).safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);if(!getStaffLoginConfig())return authResponse({error:'unavailable'},503);
 try{const wait=await consumeAuthLimit(p.data.email.toLowerCase(),'live_access');if(wait)return authResponse({error:'rate_limited'},429,wait);const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);const result=await client.auth.signInWithPassword({email:p.data.email,password:p.data.password,options:{captchaToken:p.data.captchaToken}});if(result.error||!result.data.user)return authResponse({error:'invalid_credentials'},401);const context=await client.rpc('get_live_account_context',{p_mfa:false});const parsed=liveContext.safeParse(context.data);if(context.error||!parsed.success||parsed.data.user_id!==result.data.user.id){await client.auth.signOut({scope:'local'});return authResponse({error:'access_unavailable'},403);}return authResponse({ok:true,requiresMfa:true});}catch{return authResponse({error:'unavailable'},503);}}
