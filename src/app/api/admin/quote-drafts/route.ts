import {createHash} from 'node:crypto';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {quoteDraftSchema,buildQuoteSnapshot} from '@/lib/billing/quote-snapshot';
import {fetchBocReference} from '@/lib/billing/boc-fetch';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=quoteDraftSchema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const p=parsed.data;let referenceProof:{series:string;originalCnyCad:string;date:string}|null=null;
 try{
  if(p.rateMode==='automatic'){
   let ref;try{ref=await fetchBocReference();}catch{return authResponse({error:'reference_unavailable'},503);}
   if(ref.rate!==p.rate||ref.date!==p.referenceDate)return authResponse({error:'reference_changed'},409);
   referenceProof={series:ref.series,originalCnyCad:ref.originalCnyCad,date:ref.date};
  }
  let snapshot;try{snapshot={...buildQuoteSnapshot(p),referenceProof};}catch{return authResponse({error:'invalid_input'},400);}
  const fingerprint=createHash('sha256').update(JSON.stringify(p)).digest('hex');
  const r=await staff.client.rpc('save_agency_quote_revision',{p_org:p.organizationId,p_period:p.period,p_request:p.requestId,p_fingerprint:fingerprint,p_snapshot:snapshot,p_parent:p.parentQuoteId||null});
  if(r.error)return authResponse({error:r.error.code==='42501'?'forbidden':r.error.code==='40001'?'conflict':'save_failed'},r.error.code==='42501'?403:r.error.code==='40001'?409:502);
  return authResponse({ok:true,id:r.data});
 }catch{return authResponse({error:'unavailable'},503);}
}
