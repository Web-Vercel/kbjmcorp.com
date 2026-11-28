import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse} from '@/lib/auth/http';
export async function GET(request:Request){const id=new URL(request.url).searchParams.get('bindingId');if(!z.uuid().safeParse(id).success)return authResponse({error:'invalid_input'},400);const staff=await getStaffContext();if('error'in staff)return staffError(staff);const r=await staff.client.rpc('get_monthly_verification_state',{p_binding:id});if(r.error||!r.data)return authResponse({error:'unavailable'},503);return authResponse({ok:true,data:r.data});}
