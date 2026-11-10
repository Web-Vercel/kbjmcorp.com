import {z} from 'zod';
import {authClient} from '@/lib/auth/server';
import {authResponse} from '@/lib/auth/http';
import {serviceExportRequest,serviceExportMessages,serviceConversationCsv} from '@/lib/operations/service-export';
export const dynamic='force-dynamic';
const columns='id,subject,category,status,created_at,updated_at,statement_id,statement_month';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,locale=new URL(request.url).searchParams.get('locale')||'zh';
 if(!z.uuid().safeParse(id).success||!['zh','en'].includes(locale))return authResponse({error:'invalid_input'},400);
 try{
  const client=await authClient();if(!client)return authResponse({error:'unavailable'},503);
  const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return authResponse({error:'unauthenticated'},401);
  // All reads use the caller's session and existing request/message RLS, including finance and staff MFA.
  const result=await client.from('service_requests').select(columns).eq('id',id).maybeSingle();
  if(result.error)return authResponse({error:'unavailable'},503);if(!result.data)return authResponse({error:'not_found'},404);
  const row=serviceExportRequest.safeParse(result.data);if(!row.success||row.data.id.toLowerCase()!==id.toLowerCase())return authResponse({error:'incomplete'},502);
  const thread=await client.from('service_request_messages').select('id,request_id,body,author_role,created_at').eq('request_id',row.data.id).order('created_at').order('id').limit(201);
  const messages=serviceExportMessages.safeParse(thread.data);if(thread.error||!messages.success)return authResponse({error:'incomplete'},502);
  // Refuse a mixed copy if a reply/status changed or access was revoked during the reads.
  const latest=await client.from('service_requests').select(columns).eq('id',row.data.id).maybeSingle();
  if(latest.error)return authResponse({error:'unavailable'},503);if(!latest.data)return authResponse({error:'not_found'},404);
  const checked=serviceExportRequest.safeParse(latest.data);if(!checked.success)return authResponse({error:'incomplete'},502);
  if(JSON.stringify(checked.data)!==JSON.stringify(row.data))return authResponse({error:'changed'},409);
  const csv=serviceConversationCsv(row.data,messages.data,locale as 'zh'|'en',new Date().toISOString());
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="service-${row.data.id}.csv"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
 }catch{return authResponse({error:'unavailable'},503);}
}
