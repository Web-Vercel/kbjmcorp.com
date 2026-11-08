import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
const schema=z.object({id:z.uuid(),archived:z.enum(['yes','no']),revision:z.coerce.number().int().min(0),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const p=parsed.data;
 try{const r=await staff.client.rpc('set_agency_quote_archived',{p_id:p.id,p_archived:p.archived==='yes',p_revision:p.revision,p_note:p.note});if(r.error)return authResponse({error:r.error.code==='40001'?'conflict':r.error.code==='42501'?'forbidden':'save_failed'},r.error.code==='40001'?409:r.error.code==='42501'?403:502);return authResponse({ok:true});}catch{return authResponse({error:'unavailable'},503);}
}
