import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse} from '@/lib/auth/http';
import {fetchBocReference} from '@/lib/billing/boc-fetch';
export async function GET(request:Request){
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const month=new URL(request.url).searchParams.get('month')||undefined;
 if(month&&!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return authResponse({error:'invalid_input'},400);
 try{return authResponse({ok:true,reference:await fetchBocReference(month)});}catch{return authResponse({error:'reference_unavailable'},503);}
}
