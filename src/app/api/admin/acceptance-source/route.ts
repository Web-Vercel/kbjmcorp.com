import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {getSessionConfig} from '@/lib/auth/config';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
import {reportingConfig} from '@/lib/ads/report-client';
import {acceptanceSourceCopy} from '@/lib/ads/acceptance-source';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=z.object({snapshotId:z.uuid(),confirm:z.literal('on')}).strict().safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 // Never enable this operation merely because a caller says their data is a test.
 const config=getSessionConfig();
 if(process.env.VERCEL_ENV!=='preview'||!config||new URL(config.url).hostname!=='ziijwwbcpuynkaxsbdvg.supabase.co')return authResponse({error:'forbidden'},403);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 try{
  const org=collectionTestOrganization(),advertiser=reportingConfig();if(!org||!advertiser)return authResponse({error:'not_configured'},503);
  const company=await staff.client.from('organizations').select('name').eq('id',org).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if(company.error||company.data?.name!=='财务流程验收企业（虚构）')return authResponse({error:'forbidden'},403);
  const source=await staff.client.from('ads_reporting_snapshots').select('id,account_id,report').eq('id',parsed.data.snapshotId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if(source.error||!source.data||source.data.account_id!==advertiser.accountId)return authResponse({error:'source_not_ready'},400);
  const binding=await staff.client.from('ads_reporting_bindings').select('organization_id').eq('account_id',advertiser.accountId).abortSignal(AbortSignal.timeout(8000)).maybeSingle();
  if(binding.error||!binding.data||binding.data.organization_id===org)return authResponse({error:'source_not_ready'},400);
  let copy;try{copy=acceptanceSourceCopy(source.data.report,source.data.id,org,binding.data.organization_id);}catch{return authResponse({error:'source_not_ready'},400);}
  const saved=await staff.client.rpc('save_ads_reporting_snapshot',{p_request:copy.requestId,p_report:copy.report}).abortSignal(AbortSignal.timeout(8000));
  if(saved.error||!z.uuid().safeParse(saved.data).success)return authResponse({error:'save_failed'},502);
  const linked=await staff.client.rpc('bind_ads_reporting_account',{p_snapshot:saved.data,p_org:org,p_reference:copy.reference}).abortSignal(AbortSignal.timeout(8000));
  if(linked.error||!z.uuid().safeParse(linked.data).success)return authResponse({error:'conflict'},409);
  const shared=await staff.client.rpc('share_ads_source_snapshot',{p_snapshot:saved.data,p_binding:linked.data,p_note:copy.reference}).abortSignal(AbortSignal.timeout(8000));
  if(shared.error||!z.uuid().safeParse(shared.data).success)return authResponse({error:'conflict'},409);
  return authResponse({ok:true,receipt:{snapshotId:saved.data,bindingId:linked.data,handoffId:shared.data,organizationId:org,period:copy.report.since,notPayable:true}});
 }catch{return authResponse({error:'unavailable'},503);}
}
