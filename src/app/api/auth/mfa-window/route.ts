import {z} from 'zod';
import {getStaffContext} from '@/lib/admin/guard';
import {getLiveContext} from '@/lib/live-access/server';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {mfaDeadline} from '@/lib/auth/mfa-window';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=z.object({portal:z.enum(['admin','access']),expectedUserId:z.uuid()}).strict().safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const c=parsed.data.portal==='admin'?await getStaffContext(false):await getLiveContext(false);if('error'in c)return authResponse({error:c.error},c.status);
 if(c.user.id!==parsed.data.expectedUserId)return authResponse({error:'session_changed'},409);
 if('context'in c&&(c.context.role==='client'||c.context.role==='agent'))return authResponse({complete:true});
 try{
  const a=await c.client.auth.mfa.getAuthenticatorAssuranceLevel();if(a.error)return authResponse({error:'unavailable'},503);
  if(a.data?.currentLevel==='aal2')return authResponse({complete:true});
  const f=await c.client.auth.mfa.listFactors();if(f.error)return authResponse({error:'unavailable'},503);
  const deadline=mfaDeadline(c.user.last_sign_in_at,f.data.totp.some(f=>f.status==='verified'));
  if(deadline===null)return authResponse({error:'unavailable'},503);
  if(Date.now()<deadline)return authResponse({complete:false,deadline,serverNow:Date.now()});
  const result=await c.client.auth.signOut({scope:'local'});if(result.error)return authResponse({error:'logout_failed'},502);
  return authResponse({expired:true});
 }catch{return authResponse({error:'unavailable'},503);}
}
