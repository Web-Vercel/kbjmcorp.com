import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {fetchBocReference} from '@/lib/billing/boc-fetch';
const schema=z.object({requestId:z.uuid(),rate:z.string(),referenceDate:z.iso.date(),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const p=schema.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 let reference;try{reference=await fetchBocReference();}catch{return authResponse({error:'reference_unavailable'},503);}
 if(reference.rate!==p.data.rate||reference.date!==p.data.referenceDate)return authResponse({error:'reference_changed'},409);
 try{const result=await staff.client.rpc('register_ops_fx_reference',{p_id:p.data.requestId,p_rate:reference.rate,p_reference_date:reference.date,p_source:reference.source});
 if(result.error)return authResponse({error:result.error.code==='PGRST202'?'setup_required':result.error.code==='42501'?'forbidden':'unconfirmed'},result.error.code==='42501'?403:503);
 if(result.data!==p.data.requestId)return authResponse({error:'unconfirmed'},503);
 return authResponse({ok:true,id:result.data});}catch{return authResponse({error:'unconfirmed'},503);}
}
