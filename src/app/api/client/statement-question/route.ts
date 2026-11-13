import {z} from 'zod';
import {authClient} from '@/lib/auth/server';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {statementQuestionInput} from '@/lib/billing/statement-question';
export async function POST(request:Request){const input=await readAuthBody(request);if(input.error)return input.error;const parsed=statementQuestionInput.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 try{const client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return authResponse({error:'unauthenticated'},401);const p=parsed.data;
 const result=await client.rpc('create_statement_question',{p_statement:p.statementId,p_request:p.requestId,p_subject:p.subject,p_body:p.body});
 if(result.error){const code=result.error.code;return authResponse({error:code==='42501'?'forbidden':code==='54000'?'request_limit':code==='22023'?'invalid_input':'unavailable'},code==='42501'?403:code==='54000'?429:code==='22023'?400:503);}
 const id=z.uuid().safeParse(result.data);if(!id.success)return authResponse({error:'unavailable'},503);return authResponse({ok:true,requestId:id.data});
 }catch{return authResponse({error:'unavailable'},503);}}
