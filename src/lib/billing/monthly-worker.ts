import {recheckPostedSource} from './source-recheck';
import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchAdsReport,reportingConfig,type ReportingConnection} from '@/lib/ads/report-client';
import {fetchBocReference} from './boc-fetch';
import {buildMonthlyDraft,monthlyDraftInput} from './monthly-draft';
import {roundHalfUp} from './fx';
const jobSchema=z.object({id:z.uuid(),bindingId:z.uuid(),organizationId:z.uuid(),accountId:z.string(),month:z.string(),agreement:z.string(),leaseToken:z.uuid(),systemRate:z.unknown(),customerRate:z.unknown()});
export async function runMonthlyAutomation(client:SupabaseClient,connection?:ReportingConnection){
 const config=connection||reportingConfig();if(!config)throw new Error('source_not_configured');
 const claimed=await client.rpc('claim_monthly_automation',{p_account:config.accountId});
 if(claimed.error)throw new Error('queue_unavailable');if(claimed.data===null)return recheckPostedSource(client,config);
 const job=jobSchema.parse(claimed.data);let code='source_unavailable';
 try{
  if(job.accountId!==config.accountId){code='scope_conflict';throw new Error();}
  const selection={mode:'month' as const,month:job.month+'-01'};
  const report=await (connection?fetchAdsReport(new Date(),selection,config):fetchAdsReport(new Date(),selection));
  code='source_not_ready';
  if(report.account.id!==job.accountId||report.account.currency_code!=='CAD'||report.check!=='matched'||report.periodSpendMicros===null||report.periodSpendMicros!==report.dailySpendMicros||!['exclusive','last_day_label_verified'].includes(report.endBoundary||'')||!['complete_rows','aggregate_verified'].includes(report.coverageKind||''))throw new Error();
  code='source_verification_unavailable';
  const observation=await client.rpc('observe_monthly_source',{p_job:job.id,p_lease:job.leaseToken,p_report:report});
  if(observation.error||!['stable','awaiting_source','manual_required'].includes(observation.data?.state))throw new Error();
  if(observation.data.state!=='stable')return {state:observation.data.state,jobId:job.id};
  const amount=roundHalfUp(BigInt(report.periodSpendMicros),10000n).toString();
  code='reference_unavailable';const reference=await fetchBocReference(job.month);
  code='scope_conflict';
  const input=monthlyDraftInput.parse({requestId:job.id,organizationId:job.organizationId,bindingId:job.bindingId,sourceId:job.id,month:job.month,agreement:job.agreement,confirm:'on'});
  const built=buildMonthlyDraft(input,{id:job.id,cadMinor:amount},reference,job.systemRate,job.customerRate);
  code='storage_unavailable';
  const saved=await client.rpc('complete_monthly_automation',{p_job:job.id,p_lease:job.leaseToken,p_report:report,p_snapshot:built.snapshot});
  if(saved.error||!z.object({draftId:z.uuid(),quoteId:z.uuid(),sourceId:z.uuid()}).safeParse(saved.data).success)throw new Error();
  return {state:'prepared',jobId:job.id};
 }catch{
  // A lost completion response cannot create a second draft: the persisted job/lease is authoritative.
  const failed=await client.rpc('fail_monthly_automation',{p_job:job.id,p_lease:job.leaseToken,p_code:code});
  if(failed.error||failed.data!==true)return {state:'unconfirmed',jobId:job.id};
  return {state:'retry',jobId:job.id,error:code};
 }
}
