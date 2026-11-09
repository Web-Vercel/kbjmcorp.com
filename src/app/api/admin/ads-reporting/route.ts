import {z} from 'zod';
import {readSelectionSchema,sameReadSelection,type ReadSelection} from '@/lib/ads/read-period';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {AdsReadError,fetchAdsReport,reportingConfig} from '@/lib/ads/report-client';
import {adsFailureSchema,type AdsFailure} from '@/lib/ads/read-errors';
export const maxDuration=60;
const schema=z.object({requestId:z.uuid(),confirm:z.literal('on'),month:z.iso.date().refine(v=>v.endsWith('-01')).optional(),selection:readSelectionSchema.optional(),expectedAccountId:z.string().regex(/^adacct_[A-Za-z0-9_-]+$/).optional()}).refine(p=>!(p.month&&p.selection));
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const config=reportingConfig();if(!config)return authResponse({error:'not_configured'},503);if(parsed.data.expectedAccountId&&parsed.data.expectedAccountId!==config.accountId)return authResponse({error:'conflict'},409);
 const selection:ReadSelection=parsed.data.selection||(parsed.data.month?{mode:'month',month:parsed.data.month}:{mode:'week'});
 let phase:AdsFailure['phase']='storage_lookup';
 // A retry of an already stored request returns its receipt, without another upstream read.
 try{
 const prior=await staff.client.from('ads_reporting_snapshots').select('id,account_id,since,until,selection:report->readSelection').eq('created_by',staff.user.id).eq('request_id',parsed.data.requestId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
 if(prior.error)return authResponse({error:'storage_unavailable',diagnostic:{phase}},503);
 if(prior.data){if(prior.data.account_id!==config.accountId||!sameReadSelection(prior.data,selection))return authResponse({error:'conflict'},409);return authResponse({ok:true,id:prior.data.id,reused:true});}
 phase='read';const report=await (parsed.data.month?fetchAdsReport(new Date(),parsed.data.month):parsed.data.selection?fetchAdsReport(new Date(),selection):fetchAdsReport());phase='storage_save';const saved=await staff.client.rpc('save_ads_reporting_snapshot',{p_request:parsed.data.requestId,p_report:{...report,readSelection:selection}}).abortSignal(AbortSignal.timeout(8000));
 if(!saved.error&&typeof saved.data!=='string')return authResponse({error:'save_failed',diagnostic:{phase}},502);
 if(saved.error)return authResponse({error:saved.error.code==='40001'?'conflict':'save_failed',diagnostic:{phase}},saved.error.code==='40001'?409:502);
 return authResponse({ok:true,id:saved.data,check:report.check,coveragePending:report.startBoundary==='later_start_unverified',actualSince:report.periodRange?.since});
 }catch(e){const code=e instanceof AdsReadError?e.code:'upstream_unavailable';const details=adsFailureSchema.safeParse(e instanceof AdsReadError?e.diagnostic:{phase});return authResponse({error:code,diagnostic:details.success?details.data:{phase}},code==='invalid_period'?400:code==='upstream_rate_limit'?429:code==='account_mismatch'||code==='invalid_response'?502:503,code==='upstream_rate_limit'?60:undefined);}
}
