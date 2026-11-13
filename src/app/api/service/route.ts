import {serviceSchema} from '@/lib/operations/model';
import {serviceReplyReceipt} from '@/lib/operations/service-reply';
import {authClient} from '@/lib/auth/server';
import {authResponse,readAuthBody} from '@/lib/auth/http';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=serviceSchema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 try{
  const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return authResponse({error:'unauthenticated'},401);const p=parsed.data;
  if(p.action==='reply'&&p.replyKey){
   const requestId=p.requestId.toLowerCase();const result=await client.rpc('reply_service_request_once',{p_id:requestId,p_request:p.replyKey.toLowerCase(),p_body:p.body,p_status:p.status});
   if(result.error){const code=result.error.code;const errors:Record<string,[string,number]>={'42501':['forbidden',403],'40001':['reply_conflict',409],'54000':['reply_limit',429],'22023':['invalid_input',400],'23514':['invalid_input',400],'42883':['reply_update_required',503],PGRST202:['reply_update_required',503]};const [error,status]=errors[code]||['reply_unconfirmed',502];return authResponse({error},status);}
   const receipt=serviceReplyReceipt.safeParse(result.data);if(!receipt.success||receipt.data.request_id.toLowerCase()!==requestId)return authResponse({error:'reply_unconfirmed'},502);
   return authResponse({ok:true,receipt:receipt.data});
  }
  // Keep older clients compatible. The current reply form always sends a stable replyKey.
  const result=p.action==='create'?await client.rpc('create_service_request',{p_org:p.organizationId,p_category:p.category,p_subject:p.subject,p_body:p.body}):await client.rpc('reply_service_request',{p_id:p.requestId,p_body:p.body,p_status:p.status});
  if(result.error)return authResponse({error:'save_failed'},result.error.code==='42501'?403:result.error.code==='54000'?429:result.error.code==='23514'||result.error.code==='22023'?400:502);
  return authResponse({ok:true});
 }catch{return authResponse({error:'unavailable'},503);}
}
