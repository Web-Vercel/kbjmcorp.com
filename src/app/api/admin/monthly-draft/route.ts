import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {buildMonthlyDraft,monthlyDraftInput} from '@/lib/billing/monthly-draft';
import {fetchBocReference} from '@/lib/billing/boc-fetch';
import {monthCloseOverview} from '@/lib/operations/month-close-overview';
export const maxDuration=60;
const preparationNote='Automated monthly calculation; awaiting independent financial review.';
export async function POST(request:Request){
 const body=await readAuthBody(request);if(body.error)return body.error;
 const parsed=monthlyDraftInput.safeParse(body.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const p=parsed.data,period=p.month+'-01';
 try{
  // Scope and source readiness remain authoritative database decisions, not browser amounts.
  const overview=await staff.client.rpc('get_month_close_overview',{p_org:p.organizationId,p_month:period});
  const close=!overview.error?monthCloseOverview(overview.data,{organizationId:p.organizationId,month:period}):null;
  if(!close)return authResponse({error:'source_unavailable'},503);
  const account=close.accounts.find(a=>a.binding_id===p.bindingId);
  if(!account?.active||!account.source_ready||!account.source_id||account.source_cad_minor===null)return authResponse({error:'source_not_ready'},409);
  if(account.source_id!==p.sourceId)return authResponse({error:'conflict'},409);
  if(account.statement_id)return authResponse({error:'already_published'},409);
  const prior=await staff.client.from('agency_quote_snapshots').select('id,organization_id,period,private_snapshot').eq('created_by',staff.user.id).eq('request_id',p.requestId).maybeSingle();
  if(prior.error)return authResponse({error:'storage_unavailable'},503);
  let quoteId:string;
  if(prior.data){
   const old=prior.data,proof=old.private_snapshot?.automation;
   if(old.organization_id!==p.organizationId||old.period!==period||proof?.version!=='monthly-draft-v1'||proof.sourceId!==account.source_id||proof.bindingId!==p.bindingId||proof.agreement!==p.agreement)return authResponse({error:'conflict'},409);
   quoteId=old.id; // A retry uses the locked source, fees and FX, never today's values.
  }else{
   if(account.draft_id)return authResponse({error:'draft_exists'},409);
   const query=()=>staff.client.from('monthly_pricing_rates').select('revision,organization_id,effective_month,canada_bps,china_bps,transfer_bps').lte('effective_month',period).order('effective_month',{ascending:false}).order('revision',{ascending:false}).limit(1);
   const [system,customer]=await Promise.all([query().is('organization_id',null).maybeSingle(),query().eq('organization_id',p.organizationId).maybeSingle()]);
   if(system.error||customer.error)return authResponse({error:'rates_unavailable'},503);
   let reference;try{reference=await fetchBocReference(p.month);}catch{return authResponse({error:'reference_unavailable'},503);}
   const built=buildMonthlyDraft(p,{id:account.source_id,cadMinor:account.source_cad_minor},reference,system.data,customer.data);
   const saved=await staff.client.rpc('save_agency_quote_revision',{p_org:p.organizationId,p_period:period,p_request:p.requestId,p_fingerprint:built.fingerprint,p_snapshot:built.snapshot,p_parent:null});
   if(saved.error||!z.uuid().safeParse(saved.data).success)return authResponse({error:'quote_unconfirmed'},503);
   quoteId=saved.data;
  }
  const prepared=await staff.client.rpc('prepare_monthly_settlement',{p_snapshot:account.source_id,p_quote:quoteId,p_agreement:p.agreement,p_note:preparationNote});
  if(prepared.error||!z.uuid().safeParse(prepared.data).success)return authResponse({error:'preparation_unconfirmed',quoteId},503);
  return authResponse({ok:true,receipt:{draftId:prepared.data,quoteId,sourceId:account.source_id,bindingId:p.bindingId,organizationId:p.organizationId,month:p.month,status:'awaiting_review'}});
 }catch{return authResponse({error:'unavailable'},503);}
}
