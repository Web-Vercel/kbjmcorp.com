import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {spendMicros} from '@/lib/ads/report-model';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('submit'),snapshotId:z.uuid(),requestId:z.uuid(),kind:z.enum(['activity','zero','not_active']),amount:z.string().regex(/^\d{1,12}(\.\d{1,6})?$/),impressions:z.string().regex(/^\d{1,16}$/),clicks:z.string().regex(/^\d{1,16}$/),evidence:z.string().trim().min(3).max(1000),hash:z.string().regex(/^[a-f0-9]{64}$/),activeFrom:z.union([z.literal(''),z.iso.date()]).optional(),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
 z.object({action:z.literal('review'),checkId:z.uuid(),decision:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
]);
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);const p=parsed.data;
 try{
 const result=p.action==='submit'?await staff.client.rpc('submit_ads_month_coverage',{p_snapshot:p.snapshotId,p_request:p.requestId,p_kind:p.kind,p_amount:spendMicros(p.amount),p_impressions:p.impressions,p_clicks:p.clicks,p_evidence:p.evidence,p_hash:p.hash,p_active_from:p.activeFrom||null,p_note:p.note}):await staff.client.rpc('review_ads_month_coverage',{p_check:p.checkId,p_decision:p.decision,p_note:p.note});
 if(result.error){const code=result.error.code;return authResponse({error:code==='42501'?'forbidden':code==='40001'||code==='23505'?'conflict':code==='23514'?'coverage_difference':code==='22023'?'coverage_input':'save_failed'},code==='42501'?403:code==='40001'||code==='23505'?409:code==='23514'||code==='22023'?400:502);}
 if(p.action==='submit'){if(!z.uuid().safeParse(result.data).success)return authResponse({error:'coverage_unconfirmed'},502);return authResponse({ok:true,checkId:result.data,snapshotId:p.snapshotId,stage:'submitted'});}
 return authResponse({ok:true,checkId:p.checkId,stage:p.decision});
 }catch{return authResponse({error:'unavailable'},503);}
}
