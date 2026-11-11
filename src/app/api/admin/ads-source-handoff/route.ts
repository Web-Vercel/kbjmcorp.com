import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
const note=z.string().trim().min(3).max(1000);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('bind'),snapshotId:z.uuid(),organizationId:z.uuid(),reference:note,confirm:z.literal('on')}),
 z.object({action:z.literal('access'),bindingId:z.uuid(),active:z.enum(['yes','no']),revision:z.coerce.number().int().positive(),note,confirm:z.literal('on')}),
 z.object({action:z.literal('share'),bindingId:z.uuid(),snapshotId:z.uuid(),note,confirm:z.literal('on')}),
]);
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);const p=parsed.data;
 const [name,args]=p.action==='bind'?['bind_ads_reporting_account',{p_snapshot:p.snapshotId,p_org:p.organizationId,p_reference:p.reference}]:p.action==='access'?['set_ads_binding_active',{p_id:p.bindingId,p_active:p.active==='yes',p_revision:p.revision,p_note:p.note}]:['share_ads_source_snapshot',{p_snapshot:p.snapshotId,p_binding:p.bindingId,p_note:p.note}];
 try{const result=await staff.client.rpc(name as string,args as Record<string,unknown>);if(result.error){const code=result.error.code;return authResponse({error:code==='23505'?'already_linked':code==='40001'?'conflict':code==='42501'?'forbidden':code==='22023'?'invalid_input':'save_failed'},code==='23505'||code==='40001'?409:code==='42501'?403:code==='22023'?400:502);}if(p.action==='share'){if(!z.uuid().safeParse(result.data).success)return authResponse({error:'handoff_unconfirmed'},502);return authResponse({ok:true,handoff:{id:result.data,bindingId:p.bindingId,snapshotId:p.snapshotId}});}return authResponse({ok:true});}catch{return authResponse({error:'unavailable'},503);}
}
