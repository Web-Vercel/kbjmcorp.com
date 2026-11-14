import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {NextResponse} from 'next/server';
import {getStaffContext} from '@/lib/admin/guard';import {getLiveContext} from '@/lib/live-access/server';
import {hasSameOrigin} from '@/lib/http/request-origin';import {authResponse} from '@/lib/auth/http';
import {maxFileBytes,evidenceMime} from '@/lib/partners/files';
export const runtime='nodejs';
async function actor(){const staff=await getStaffContext();if(!('error'in staff)&&staff.role==='admin')return {client:staff.client,agentId:null};const a=await getLiveContext();if('error'in a||a.context.role!=='agent')return null;return {client:a.client,agentId:a.context.organization_id};}
export async function POST(request:Request){
 if(!hasSameOrigin(request))return authResponse({error:'forbidden'},403);const auth=await actor();if(!auth)return authResponse({error:'forbidden'},403);
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))return authResponse({error:'multipart_required'},415);
 try{const reader=request.body?.getReader();if(!reader)return authResponse({error:'invalid_input'},400);const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>maxFileBytes+65536){await reader.cancel();return authResponse({error:'too_large'},413);}chunks.push(r.value);}
 const form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')!},body:Buffer.concat(chunks)}).formData();
 const parsed=z.object({agentId:z.uuid(),leadId:z.union([z.uuid(),z.literal('')]),assignmentId:z.union([z.uuid(),z.literal('')]),kind:z.enum(['agreement','referral'])}).safeParse(Object.fromEntries(form));const file=form.get('file');
 if(!parsed.success||!(file instanceof File)||!file.size||file.size>maxFileBytes||file.name.length>180)return authResponse({error:'invalid_input'},400);
 const p=parsed.data;if(auth.agentId&&auth.agentId!==p.agentId)return authResponse({error:'forbidden'},403);
 const bytes=new Uint8Array(await file.arrayBuffer()),mime=evidenceMime(bytes);if(!mime||mime!==file.type)return authResponse({error:'invalid_file'},400);
 const id=randomUUID(),extension=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg',path=`${p.agentId}/${id}/document.${extension}`;
 const upload=await auth.client.storage.from('partner-documents').upload(path,bytes,{contentType:mime,upsert:false});if(upload.error)return authResponse({error:'storage_unavailable'},503);
 const saved=await auth.client.rpc('register_partner_file',{p_id:id,p_agent:p.agentId,p_lead:p.leadId||null,p_kind:p.kind,p_name:file.name,p_path:path,p_mime:mime,p_size:file.size,p_assignment:p.assignmentId||null,p_hash:createHash('sha256').update(bytes).digest('hex')});
 if(saved.error||saved.data!==id){return authResponse({error:'unconfirmed'},503);}return authResponse({ok:true,id});
 }catch{return authResponse({error:'unavailable'},503);}
}
export async function GET(request:Request){const auth=await actor();if(!auth)return authResponse({error:'forbidden'},403);const id=z.uuid().safeParse(new URL(request.url).searchParams.get('id'));if(!id.success)return authResponse({error:'invalid_input'},400);
 try{const r=await auth.client.rpc('read_partner_file',{p_id:id.data});const p=z.object({path:z.string(),name:z.string()}).safeParse(r.data);if(r.error||!p.success)return authResponse({error:'forbidden'},403);const signed=await auth.client.storage.from('partner-documents').createSignedUrl(p.data.path,60);if(signed.error||!signed.data?.signedUrl)return authResponse({error:'unavailable'},503);return NextResponse.redirect(signed.data.signedUrl,{status:302,headers:{'Cache-Control':'private, no-store'}});}catch{return authResponse({error:'unavailable'},503);}
}
