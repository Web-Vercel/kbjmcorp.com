import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse} from '@/lib/auth/http';
import {fetchBocReference} from '@/lib/billing/boc-fetch';
export async function GET(){
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 try{return authResponse({ok:true,reference:await fetchBocReference()});}catch{return authResponse({error:'reference_unavailable'},503);}
}
