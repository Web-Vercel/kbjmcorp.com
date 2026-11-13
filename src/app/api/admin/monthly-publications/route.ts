import {collectionTestOrganization} from '@/lib/collections/test-mode';
import {acceptancePrefix} from '@/lib/billing/acceptance';
import {publicationInput} from '@/lib/billing/publication-input';
import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {checkedPublicationQuote} from '@/lib/billing/publication';
const schema=publicationInput;
const inputSchema=z.object({quote_id:z.uuid(),organization_id:z.uuid(),period:z.iso.date(),private_snapshot:z.unknown()});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;const p=schema.safeParse(input.body);if(!p.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 try{
 const loaded=await staff.client.rpc('get_monthly_publication_input',{p_draft:p.data.draftId});if(loaded.error)return authResponse({error:'unavailable'},503);
 const parsed=inputSchema.safeParse(loaded.data);if(!parsed.success)return authResponse({error:'invalid_quote'},400);
 let expected;try{expected=checkedPublicationQuote(parsed.data.private_snapshot,{id:parsed.data.quote_id,organizationId:parsed.data.organization_id,period:parsed.data.period});}catch{return authResponse({error:'invalid_quote'},400);}
 const testOrg=collectionTestOrganization();
 let summary=p.data.summary;
 if(testOrg){
  if(parsed.data.organization_id!==testOrg)return authResponse({error:'forbidden'},403);
  const company=await staff.client.from('organizations').select('name').eq('id',testOrg).maybeSingle();
  if(company.error||company.data?.name!=='财务流程验收企业（虚构）')return authResponse({error:'forbidden'},403);
  summary=acceptancePrefix+summary.replace(/^\[ACCEPTANCE-TEST-NOT-PAYABLE\] /,'').slice(0,2000-acceptancePrefix.length);
 }
 const result=await staff.client.rpc('publish_monthly_statement',{p_draft:p.data.draftId,p_summary:summary,p_expected:expected});
 if(result.error){const code=result.error.code;return authResponse({error:code==='42501'?'forbidden':code==='23505'?'already_posted':code==='P0003'?'insufficient_balance':code==='P0002'?'wallet_required':code==='40001'?'conflict':code==='23514'?'source_not_ready':'save_failed'},code==='42501'?403:code==='23505'||code==='40001'?409:code==='P0003'||code==='P0002'||code==='23514'?400:502);}
 if(!z.uuid().safeParse(result.data).success)return authResponse({error:'unavailable'},503);
 return authResponse({ok:true,id:result.data,draftId:p.data.draftId,organizationId:parsed.data.organization_id,period:parsed.data.period});
 }catch{return authResponse({error:'unavailable'},503);}
}
