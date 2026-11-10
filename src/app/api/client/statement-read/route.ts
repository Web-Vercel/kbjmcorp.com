import {z} from 'zod';
import {authClient} from '@/lib/auth/server';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {statementReadReceipt} from '@/lib/billing/statement-read';
const schema=z.object({statementId:z.uuid(),confirm:z.literal('on')});
export async function POST(request:Request){const input=await readAuthBody(request);if(input.error)return input.error;const p=schema.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 try{const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);const user=await client.auth.getUser();if(user.error||!user.data.user)return authResponse({error:'unauthenticated'},401);
 const result=await client.rpc('confirm_client_statement_read',{p_statement:p.data.statementId});if(result.error)return authResponse({error:result.error.code==='42501'?'forbidden':'unavailable'},result.error.code==='42501'?403:503);
 const receipt=statementReadReceipt.safeParse(result.data);if(!receipt.success||receipt.data.statement_id!==p.data.statementId)return authResponse({error:'unavailable'},503);return authResponse({ok:true,receipt:receipt.data});
 }catch{return authResponse({error:'unavailable'},503);}}
