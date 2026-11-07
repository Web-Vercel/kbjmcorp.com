import {collectionTestOrganization,validTestAccount,validTestWallet,testAccountNumber,testEvidence} from '@/lib/collections/test-mode';
import {collectionSchema} from '@/lib/collections/model';
import {toMinor} from '@/lib/billing/model';
import {getStaffContext,staffError} from '@/lib/admin/guard';
import {authResponse,readAuthBody} from '@/lib/auth/http';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=collectionSchema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);
 const p=parsed.data;if(['account','assign','active'].includes(p.action)&&staff.role!=='admin')return authResponse({error:'forbidden'},403);
 const testOrg=collectionTestOrganization();
 if(testOrg){
  try{
   if(p.action==='account'){
    const company=await staff.client.from('organizations').select('name').eq('id',testOrg).maybeSingle();
    if(company.error||company.data?.name!=='财务流程验收企业（虚构）')return authResponse({error:'forbidden'},403);
    p.legalName='虚构测试收款公司—不可付款';p.bankName='虚构测试银行—不可付款';p.accountNumber=testAccountNumber;p.evidence=testEvidence;
   }else if(p.action==='active'){
    if(!await validTestAccount(staff.client,p.accountId))return authResponse({error:'forbidden'},403);
   }else if(p.action==='review'){
    const r=await staff.client.from('bank_receipts').select('wallet_id,collection_account_id,evidence_reference').eq('id',p.receiptId).maybeSingle();
    if(r.error||!r.data||!r.data.evidence_reference.startsWith('FICTIONAL-')||!await validTestWallet(staff.client,r.data.wallet_id,testOrg)||!await validTestAccount(staff.client,r.data.collection_account_id))return authResponse({error:'forbidden'},403);
    p.note='FICTIONAL TEST ONLY: '+p.note.slice(0,970);
   }else{
    if(!await validTestWallet(staff.client,p.walletId,testOrg))return authResponse({error:'forbidden'},403);
    if(p.action==='assign'){
     if(!await validTestAccount(staff.client,p.accountId))return authResponse({error:'forbidden'},403);
     p.agreement='FICTIONAL-TEST-AGREEMENT';
    }else{
     const link=await staff.client.from('wallet_collection_accounts').select('collection_account_id').eq('wallet_id',p.walletId).maybeSingle();
     if(link.error||!link.data||!await validTestAccount(staff.client,link.data.collection_account_id))return authResponse({error:'forbidden'},403);
     p.evidence='FICTIONAL-TEST-ONLY';p.payerName='虚构付款企业—无真实付款';p.bankReference='FICTIONAL-'+p.bankReference.slice(0,100);
    }
   }
  }catch{return authResponse({error:'unavailable'},503);}
 }
 let name:string,args:Record<string,unknown>;
 switch(p.action){
 case 'account':name='create_collection_account';args={p_legal:p.legalName,p_bank:p.bankName,p_number:p.accountNumber,p_evidence:p.evidence};break;
 case 'assign':name='assign_collection_account';args={p_wallet:p.walletId,p_account:p.accountId,p_agreement:p.agreement};break;
 case 'active':name='set_collection_account_active';args={p_account:p.accountId,p_active:p.active==='yes'};break;
 case 'receipt':name='prepare_bank_receipt';args={p_wallet:p.walletId,p_topup:p.topupId||null,p_amount:toMinor(p.amount),p_payer:p.payerName,p_bank_reference:p.bankReference,p_booked:p.bookedDate,p_evidence:p.evidence};break;
 case 'review':name='review_bank_receipt';args={p_receipt:p.receiptId,p_decision:p.decision,p_note:p.note};break;
 }
 try{const result=await staff.client.rpc(name,args);if(result.error){const c=result.error.code;return authResponse({error:c==='42501'?'forbidden':c==='23505'?'duplicate_reference':c==='40001'?'conflict':'save_failed'},c==='42501'?403:['23505','40001'].includes(c)?409:['22023','23514','23503','23502'].includes(c)?400:502);}return authResponse({ok:true});}catch{return authResponse({error:'unavailable'},503);}
}
