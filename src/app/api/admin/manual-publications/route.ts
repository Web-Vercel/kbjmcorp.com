import {z} from 'zod';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {readAuthBody,authResponse} from '@/lib/auth/http';
import {manualPublicationInput,manualPublicationPreview} from '@/lib/billing/manual-publication';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
import {acceptancePrefix} from '@/lib/billing/acceptance';
export async function POST(request:Request){
 const body=await readAuthBody(request);if(body.error)return body.error;
 const input=manualPublicationInput.safeParse(body.body);if(!input.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);if(staff.role!=='admin')return authResponse({error:'forbidden'},403);
 try{
 const loaded=await staff.client.rpc('get_manual_publication',{p_draft:input.data.draftId});
 if(loaded.error)return authResponse({error:loaded.error.code==='PGRST202'?'setup_required':'unavailable'},503);
 const proof=manualPublicationPreview.safeParse(loaded.data);if(!proof.success||proof.data.draftId!==input.data.draftId)return authResponse({error:'unavailable'},503);
 const testOrg=collectionTestOrganization();
 if(testOrg){if(proof.data.organizationId!==testOrg)return authResponse({error:'forbidden'},403);const org=await staff.client.from('organizations').select('name').eq('id',testOrg).maybeSingle();if(org.error||org.data?.name!=='财务流程验收企业（虚构）')return authResponse({error:'forbidden'},403);}
 if(input.data.action==='preview')return authResponse({ok:true,...proof.data});
 const summary=testOrg||proof.data.testRecord?acceptancePrefix+input.data.summary.replace(/^\[ACCEPTANCE-TEST-NOT-PAYABLE\] /,'').slice(0,2000-acceptancePrefix.length):input.data.summary;
 const saved=await staff.client.rpc('publish_manual_statement',{p_draft:input.data.draftId,p_summary:summary});
 if(saved.error){const code=saved.error.code;return authResponse({error:code==='42501'?'forbidden':code==='23505'?'already_posted':code==='P0003'?'insufficient_balance':code==='P0002'?'wallet_required':code==='40001'?'conflict':code==='23514'?'source_not_ready':'unavailable'},code==='42501'?403:['23505','40001'].includes(code)?409:['P0003','P0002','23514'].includes(code)?400:503);}
 if(!z.uuid().safeParse(saved.data).success)return authResponse({error:'unavailable'},503);
 // Confirm persisted receipt, not just a successful request or an arbitrary UUID.
 const checked=await staff.client.rpc('get_manual_publication',{p_draft:input.data.draftId});const receipt=manualPublicationPreview.safeParse(checked.data);
 if(checked.error||!receipt.success||receipt.data.statementId!==saved.data||receipt.data.draftId!==proof.data.draftId||receipt.data.organizationId!==proof.data.organizationId||receipt.data.period!==proof.data.period||receipt.data.amountMinor!==proof.data.amountMinor)return authResponse({error:'unavailable'},503);
 return authResponse({ok:true,id:saved.data,draftId:proof.data.draftId,organizationId:proof.data.organizationId,period:proof.data.period});
 }catch{return authResponse({error:'unavailable'},503);}
}
