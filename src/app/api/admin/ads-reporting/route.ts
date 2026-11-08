import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {AdsReadError,fetchAdsReport,reportingConfig} from '@/lib/ads/report-client';
export const maxDuration=60;
const schema=z.object({requestId:z.uuid(),confirm:z.literal('on')});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const config=reportingConfig();if(!config)return authResponse({error:'not_configured'},503);
 // A retry of an already stored request returns its receipt, without another upstream read.
 try{
 const prior=await staff.client.from('ads_reporting_snapshots').select('id,account_id').eq('created_by',staff.user.id).eq('request_id',parsed.data.requestId).maybeSingle();
 if(prior.error)return authResponse({error:'storage_unavailable'},503);
 if(prior.data){if(prior.data.account_id!==config.accountId)return authResponse({error:'conflict'},409);return authResponse({ok:true,id:prior.data.id,reused:true});}
 const report=await fetchAdsReport();const saved=await staff.client.rpc('save_ads_reporting_snapshot',{p_request:parsed.data.requestId,p_report:report});
 if(!saved.error&&typeof saved.data!=='string')return authResponse({error:'save_failed'},502);
 if(saved.error)return authResponse({error:saved.error.code==='40001'?'conflict':'save_failed'},saved.error.code==='40001'?409:502);
 return authResponse({ok:true,id:saved.data});
 }catch(e){const code=e instanceof AdsReadError?e.code:'upstream_unavailable';return authResponse({error:code},code==='upstream_rate_limit'?429:code==='account_mismatch'||code==='invalid_response'?502:503,code==='upstream_rate_limit'?60:undefined);}
}
