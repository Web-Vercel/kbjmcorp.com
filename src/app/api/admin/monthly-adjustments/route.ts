import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('prepare'),differenceId:z.uuid(),requestId:z.uuid(),reference:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
 z.object({action:z.literal('review'),draftId:z.uuid(),decision:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
 z.object({action:z.literal('publish'),draftId:z.uuid(),confirm:z.literal('on')})
]);
export async function GET(request:Request){const id=new URL(request.url).searchParams.get('bindingId');if(!z.uuid().safeParse(id).success)return authResponse({error:'invalid_input'},400);const staff=await getStaffContext();if('error'in staff)return staffError(staff);const r=await staff.client.rpc('list_monthly_adjustments',{p_binding:id});return r.error?authResponse({error:'unavailable'},503):authResponse({ok:true,data:r.data});}
export async function POST(request:Request){const body=await readAuthBody(request);if(body.error)return body.error;const p=schema.safeParse(body.body);if(!p.success)return authResponse({error:'invalid_input'},400);const staff=await getStaffContext();if('error'in staff)return staffError(staff);const v=p.data;let r;
 if(v.action==='prepare')r=await staff.client.rpc('prepare_monthly_adjustment',{p_difference:v.differenceId,p_request:v.requestId,p_reference:v.reference});
 else if(v.action==='review')r=await staff.client.rpc('review_monthly_adjustment',{p_draft:v.draftId,p_decision:v.decision,p_note:v.note});
 else r=await staff.client.rpc('publish_monthly_adjustment',{p_draft:v.draftId,p_test_org:collectionTestOrganization()});
 if(r.error)return authResponse({error:r.error.code==='42501'?'forbidden':r.error.code==='40001'?'conflict':'save_failed'},r.error.code==='42501'?403:['40001','23514','22023'].includes(r.error.code)?409:503);
 if(v.action!=='review'&&!z.uuid().safeParse(r.data).success)return authResponse({error:'unconfirmed'},503);
 return authResponse({ok:true,id:r.data,published:v.action==='publish'});
}
