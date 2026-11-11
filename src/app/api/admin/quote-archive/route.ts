import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
const schema=z.object({id:z.uuid(),archived:z.enum(['yes','no']),revision:z.coerce.number().int().min(0).max(2147483647),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const p=parsed.data;
 try{
  const r=await staff.client.rpc('set_agency_quote_archived',{p_id:p.id,p_archived:p.archived==='yes',p_revision:p.revision,p_note:p.note});
  if(r.error){const errors:Record<string,[string,number]>={'40001':['conflict',409],'42501':['forbidden',403],P0002:['quote_unavailable',404],'22023':['invalid_input',400]};const [error,status]=errors[r.error.code]||['save_failed',502];return authResponse({error},status);}
  if(!z.number().int().min(0).max(2147483647).safeParse(r.data).success)return authResponse({error:'archive_unconfirmed'},502);
  return authResponse({ok:true,receipt:{id:p.id,archived:p.archived==='yes',stateRevision:r.data}});
 }catch{return authResponse({error:'unavailable'},503);}
}
