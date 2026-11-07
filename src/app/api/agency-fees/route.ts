import {decimalMinor} from '@/lib/billing/agency-fees';
import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {readAuthBody,authResponse} from '@/lib/auth/http';
const schema=z.object({organizationId:z.uuid(),unit:z.enum(['kbjm_ca','zhidian_cn']),month:z.iso.date().refine(s=>s.endsWith('-01')),mode:z.enum(['percentage','fixed','greater_of']),basis:z.enum(['platform_ad_spend','upstream_total']),percent:z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).refine(v=>{try{return BigInt(decimalMinor(v))<=10000n;}catch{return false;}}),fixed:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),minimum:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),waive:z.enum(['yes','no']),note:z.string().trim().min(3).max(1000),confirm:z.literal('on')}).refine(p=>p.unit!=='kbjm_ca'||p.basis==='platform_ad_spend');
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const p=parsed.data;
 try{const r=await staff.client.rpc('save_agency_fee_draft',{p_org:p.organizationId,p_unit:p.unit,p_month:p.month,p_mode:p.mode,p_basis:p.basis,p_bps:Number(decimalMinor(p.percent)),p_fixed:decimalMinor(p.fixed),p_minimum:decimalMinor(p.minimum),p_waive:p.waive==='yes',p_note:p.note});return r.error?authResponse({error:r.error.code==='42501'?'forbidden':'save_failed'},r.error.code==='42501'?403:400):authResponse({ok:true});}catch{return authResponse({error:'unavailable'},503);}
}
