import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
export const testAccountNumber='TEST-NOT-PAYABLE-001';
export const testEvidence='FICTIONAL-TEST-ONLY-001';
export function collectionTestOrganization():string|null {
 const id=process.env.COLLECTIONS_TEST_ORGANIZATION_ID;
 if(process.env.VERCEL_ENV!=='preview'||!id)return null;
 if(!z.uuid().safeParse(id).success)throw new Error('Invalid collections test organization');
 return id;
}
export async function validTestWallet(client:SupabaseClient,walletId:string,org:string){
 const r=await client.from('client_wallets').select('organization_id,currency').eq('id',walletId).maybeSingle();
 if(r.error||r.data?.organization_id!==org||r.data.currency!=='CNY')return false;
 const company=await client.from('organizations').select('name').eq('id',org).maybeSingle();
 return !company.error&&company.data?.name==='财务流程验收企业（虚构）';
}
export async function validTestAccount(client:SupabaseClient,id:string){
 const r=await client.from('collection_accounts').select('account_number,verification_reference').eq('id',id).maybeSingle();
 return !r.error&&r.data?.account_number===testAccountNumber&&r.data.verification_reference===testEvidence;
}
