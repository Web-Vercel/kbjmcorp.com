import {liveContext} from '@/lib/live-access/model';
import {authClient} from '@/lib/auth/server';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {partnerCommand,actionReceipt} from '@/lib/partners/model';
export async function POST(request:Request){
 const input=await readAuthBody(request,16384);if(input.error)return input.error;
 const p=partnerCommand.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);
 try{const user=await client.auth.getUser();if(user.error||!user.data.user)return authResponse({error:'unauthenticated'},401);
 let passwordAction=false;if(['lead_submit','refund_request','refund_cancel'].includes(p.data.action)){const context=await client.rpc('get_live_account_context',{p_mfa:false});const parsed=liveContext.safeParse(context.data);passwordAction=!context.error&&parsed.success&&parsed.data.user_id===user.data.user.id&&((p.data.action==='lead_submit'&&parsed.data.role==='agent')||(['refund_request','refund_cancel'].includes(p.data.action)&&parsed.data.role==='client'));}
 if(!passwordAction){const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=='aal2')return authResponse({error:'mfa_required'},403);}
 const {action,requestId,...data}=p.data;const result=await client.rpc('partner_finance_action',{p_action:action,p_request:requestId,p_data:data});
 if(result.error){const c=result.error.code;return authResponse({error:c==='42501'?'forbidden':c==='40001'||c==='23505'?'conflict':c==='22023'||c?.startsWith('23')?'check_required':'unavailable'},c==='42501'?403:c==='40001'||c==='23505'?409:c==='22023'||c?.startsWith('23')?400:503);}
 const parsed=actionReceipt.safeParse(result.data);if(!parsed.success||parsed.data.action!==action)return authResponse({error:'unconfirmed'},502);
 return authResponse({ok:true,receipt:parsed.data});
 }catch{return authResponse({error:'unavailable'},503);}
}
