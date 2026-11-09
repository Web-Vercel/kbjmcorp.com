import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {readAuthBody,authResponse} from '@/lib/auth/http';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('prepare'),snapshotId:z.uuid(),quoteId:z.uuid(),agreement:z.string().trim().min(3).max(1000),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
 z.object({action:z.literal('review'),draftId:z.uuid(),decision:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}),
]);
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);const p=parsed.data;
 try{
 const result=p.action==='prepare'?await staff.client.rpc('prepare_monthly_settlement',{p_snapshot:p.snapshotId,p_quote:p.quoteId,p_agreement:p.agreement,p_note:p.note}):await staff.client.rpc('review_monthly_settlement',{p_draft:p.draftId,p_decision:p.decision,p_note:p.note});
 if(result.error){const code=result.error.code;return authResponse({error:code==='42501'?'forbidden':code==='40001'?'conflict':code==='23514'?'source_not_ready':code==='22023'?'settlement_mismatch':'save_failed'},code==='42501'?403:code==='40001'?409:code==='23514'||code==='22023'?400:502);}
 return authResponse({ok:true});
 }catch{return authResponse({error:'unavailable'},503);}
}
