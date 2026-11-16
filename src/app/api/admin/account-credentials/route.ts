import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {getPrivilegedConnection} from '@/lib/auth/privileged-config';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
import {credentialInput} from '@/lib/live-access/managed-account';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=credentialInput.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const c=await getStaffContext();if('error'in c)return staffError(c);if(c.role!=='admin')return authResponse({error:'forbidden'},403);
 const d=parsed.data;if(d.userId===c.user.id)return authResponse({error:'self_change_unavailable'},400);
 const config=getPrivilegedConnection();if(!config)return authResponse({error:'unavailable'},503);
 let operationId:string|undefined;
 try{
  const wait=await consumeAuthLimit(c.user.id,'live_access');if(wait)return authResponse({error:'rate_limited'},429,wait);
  const admin=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(15000)})}});
  if(d.action==='reconcile'){
   const op=await c.client.from('account_credential_operations').select('id,target_id').eq('id',d.operationId).eq('target_id',d.userId).maybeSingle();
   if(op.error||!op.data)return authResponse({error:'maintenance_unavailable'},503);
   const result=await admin.rpc('finish_account_credential_change',{p_id:d.operationId,p_result:'reconciled',p_actor:c.user.id});
   if(result.error)return authResponse({error:result.error.code==='40001'?'maintenance_running':'maintenance_unavailable'},result.error.code==='40001'?409:503);
   if(result.data?.status!=='reconciled')return authResponse({error:'maintenance_uncertain'},409);
   return authResponse({ok:true,status:'reconciled'});
  }
  const begun=await c.client.rpc('begin_account_credential_change',{p_id:d.requestId,p_target:d.userId,p_action:d.action,p_expected_email:d.expectedEmail,p_new_email:d.action==='email'?d.email:null,p_reason:d.reason});
  if(begun.error)return authResponse({error:begun.error.code==='40001'?'maintenance_conflict':begun.error.code==='42501'?'forbidden':begun.error.code==='22023'?'account_input_invalid':'setup_required'},begun.error.code==='42501'?403:begun.error.code==='40001'?409:begun.error.code==='22023'?400:503);
  if(!z.uuid().safeParse(begun.data).success||begun.data!==d.requestId)return authResponse({error:'maintenance_uncertain'},503);
  operationId=d.requestId;
  let outcome='uncertain',error='maintenance_uncertain';
  try{
   const result=await admin.auth.admin.updateUserById(d.userId,d.action==='password'?{password:d.password}:{email:d.email,email_confirm:true});
   if(!result.error&&result.data.user?.id===d.userId){outcome='succeeded';}
   else if(result.error){
    const code=result.error.code;
    if(code&&['email_exists','email_address_invalid','same_password','weak_password','user_not_found','validation_failed'].includes(code)){outcome='failed';error=code;}
   }
  }catch{/* A timeout may still have committed in Auth. Keep access locked for reconciliation. */}
  const finished=await admin.rpc('finish_account_credential_change',{p_id:operationId,p_result:outcome,p_actor:c.user.id});
  if(finished.error||!finished.data||finished.data.status!==outcome)return authResponse({error:'maintenance_uncertain',operationId},503);
  if(outcome!=='succeeded')return authResponse({error,operationId},outcome==='failed'?400:503);
  return authResponse({ok:true,status:'succeeded',operationId});
 }catch{return authResponse({error:operationId?'maintenance_uncertain':'unavailable',...(operationId?{operationId}:{})},503);}
}
