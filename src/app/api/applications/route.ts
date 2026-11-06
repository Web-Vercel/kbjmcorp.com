import {applicationSchema,withdrawSchema} from '@/lib/applications/model';
import {authClient} from '@/lib/auth/server';
import {authResponse,readAuthBody} from '@/lib/auth/http';
export async function POST(request:Request){
 const input=await readAuthBody(request,16384);if(input.error)return input.error;
 const parsed=applicationSchema.or(withdrawSchema).safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 if(process.env.CLIENT_APPLICATIONS_ENABLED!=='true')return authResponse({error:'unavailable'},503);
 try{const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);const user=await client.auth.getUser();if(user.error||!user.data.user)return authResponse({error:'unauthenticated'},401);
 const p=parsed.data;const args=p.action==='withdraw'?{p_id:p.applicationId,p_revision:p.revision}:{p_id:p.applicationId||null,p_revision:p.revision,p_legal:p.legalName,p_contact:p.contactName,p_email:p.email,p_website:p.website,p_industry:p.industry,p_market:p.market,p_goals:p.goals,p_locale:p.locale};
 const result=await client.rpc(p.action==='withdraw'?'withdraw_customer_application':'save_customer_application',args);
 if(result.error){const c=result.error.code;return authResponse({error:c==='42501'?'forbidden':['40001','23505'].includes(c)?'conflict':'save_failed'},c==='42501'?403:['40001','23505'].includes(c)?409:c==='54000'?429:['22023','23514'].includes(c)?400:502);}return authResponse({ok:true});
 }catch{return authResponse({error:'unavailable'},503);}
}
