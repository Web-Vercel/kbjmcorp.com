import {z} from 'zod';
import {calendarMonthRange,addDays} from '@/lib/ads/report-model';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {AdsReadError,fetchAdsReport,reportingConfig} from '@/lib/ads/report-client';
import {adsFailureSchema,type AdsFailure} from '@/lib/ads/read-errors';
export const maxDuration=60;
const schema=z.object({requestId:z.uuid(),confirm:z.literal('on'),month:z.iso.date().refine(v=>v.endsWith('-01')).optional()});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const config=reportingConfig();if(!config)return authResponse({error:'not_configured'},503);
 let phase:AdsFailure['phase']='storage_lookup';
 // A retry of an already stored request returns its receipt, without another upstream read.
 try{
 const prior=await staff.client.from('ads_reporting_snapshots').select('id,account_id,since,until').eq('created_by',staff.user.id).eq('request_id',parsed.data.requestId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
 if(prior.error)return authResponse({error:'storage_unavailable',diagnostic:{phase}},503);
 if(prior.data){const expected=parsed.data.month?calendarMonthRange(parsed.data.month):null;if(prior.data.account_id!==config.accountId||(expected?(prior.data.since!==expected.since||prior.data.until!==expected.until):prior.data.until!==addDays(prior.data.since,6)))return authResponse({error:'conflict'},409);return authResponse({ok:true,id:prior.data.id,reused:true});}
 phase='read';const report=await (parsed.data.month?fetchAdsReport(new Date(),parsed.data.month):fetchAdsReport());phase='storage_save';const saved=await staff.client.rpc('save_ads_reporting_snapshot',{p_request:parsed.data.requestId,p_report:report}).abortSignal(AbortSignal.timeout(8000));
 if(!saved.error&&typeof saved.data!=='string')return authResponse({error:'save_failed',diagnostic:{phase}},502);
 if(saved.error)return authResponse({error:saved.error.code==='40001'?'conflict':'save_failed',diagnostic:{phase}},saved.error.code==='40001'?409:502);
 return authResponse({ok:true,id:saved.data});
 }catch(e){const code=e instanceof AdsReadError?e.code:'upstream_unavailable';const details=adsFailureSchema.safeParse(e instanceof AdsReadError?e.diagnostic:{phase});return authResponse({error:code,diagnostic:details.success?details.data:{phase}},code==='invalid_period'?400:code==='upstream_rate_limit'?429:code==='account_mismatch'||code==='invalid_response'?502:503,code==='upstream_rate_limit'?60:undefined);}
}
