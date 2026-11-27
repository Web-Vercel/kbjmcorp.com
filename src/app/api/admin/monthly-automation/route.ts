import {z} from 'zod';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {getStaffContext,staffError} from '@/lib/admin/guard';
const schema=z.object({bindingId:z.uuid(),enabled:z.enum(['yes','no']),firstMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(m=>z.iso.date().safeParse(m+'-01').success),agreement:z.string().trim().min(3).max(1000),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const p=schema.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const r=await staff.client.rpc('configure_monthly_automation',{p_binding:p.data.bindingId,p_enabled:p.data.enabled==='yes',p_agreement:p.data.agreement,p_first_month:p.data.firstMonth+'-01'});
 if(r.error||!z.number().int().positive().safeParse(r.data).success)return authResponse({error:'save_failed'},503);
 return authResponse({ok:true,revision:r.data});
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('bindingId');if(!z.uuid().safeParse(id).success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const [settings,jobs]=await Promise.all([staff.client.from('monthly_automation_settings').select('enabled,agreement,revision,first_month').eq('binding_id',id).maybeSingle(),staff.client.from('monthly_automation_jobs').select('id,month,state,attempts,error_code,draft_id,updated_at').eq('binding_id',id).order('month',{ascending:false}).limit(3)]);
 if(settings.error||jobs.error)return authResponse({error:'unavailable'},503);
 return authResponse({ok:true,settings:settings.data,jobs:jobs.data});
}
