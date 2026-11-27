import {z} from 'zod';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {decimalMinor} from '@/lib/billing/agency-fees';
import {automaticReleaseEnabled} from '@/lib/billing/automatic-release';
const decimal=z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
const schema=z.object({bindingId:z.uuid(),enabled:z.enum(['yes','no']),canada:decimal,china:decimal,transfer:decimal,maxAmount:decimal,growth:decimal,agreement:z.string().trim().min(3).max(1000),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const p=schema.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const v=p.data;const rates=[v.canada,v.china,v.transfer].map(n=>Number(decimalMinor(n))),max=decimalMinor(v.maxAmount),growth=Number(decimalMinor(v.growth));
 if(rates.some(n=>n>10000)||BigInt(max)<1n||BigInt(max)>9999999999n||growth>100000)return authResponse({error:'invalid_input'},400);
 const r=await staff.client.rpc('configure_monthly_auto_release',{p_binding:v.bindingId,p_enabled:v.enabled==='yes',p_canada:rates[0],p_china:rates[1],p_transfer:rates[2],p_max:max,p_growth:growth,p_agreement:v.agreement});
 if(r.error||!z.number().int().positive().safeParse(r.data).success)return authResponse({error:'save_failed'},503);
 return authResponse({ok:true,revision:r.data});
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('bindingId');if(!z.uuid().safeParse(id).success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const [policy,state]=await Promise.all([staff.client.from('monthly_auto_release_policies').select('enabled,revision,agreement,max_minor,max_growth_bps,canada_bps,china_bps,transfer_bps').eq('binding_id',id).maybeSingle(),staff.client.rpc('get_auto_release_state',{p_binding:id})]);
 if(policy.error||state.error)return authResponse({error:'unavailable'},503);
 return authResponse({ok:true,policy:policy.data,runs:state.data?.runs||[],workerEnabled:automaticReleaseEnabled()});
}
