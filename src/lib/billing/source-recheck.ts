import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchAdsReport,type ReportingConnection} from '@/lib/ads/report-client';
export async function recheckPostedSource(client:SupabaseClient,config:ReportingConnection){
 const r=await client.rpc('claim_statement_recheck',{p_account:config.accountId});if(r.error)return {state:'unconfirmed'};if(r.data===null)return {state:'idle'};
 const parsed=z.object({statementId:z.uuid(),accountId:z.literal(config.accountId),month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),leaseToken:z.uuid()}).safeParse(r.data);if(!parsed.success)return {state:'unconfirmed'};const j=parsed.data;
 let report=null;try{report=await fetchAdsReport(new Date(),{mode:'month',month:j.month+'-01'},config);}catch{/* Persist failed retrieval; never label it a match. */}
 const saved=await client.rpc('record_statement_recheck',{p_statement:j.statementId,p_lease:j.leaseToken,p_report:report});if(saved.error){await client.rpc('record_statement_recheck',{p_statement:j.statementId,p_lease:j.leaseToken,p_report:null});return {state:'unconfirmed'};}if(!['idle','manual_required','unconfirmed'].includes(saved.data?.state))return {state:'unconfirmed'};return {state:saved.data.state,statementId:j.statementId};
}
