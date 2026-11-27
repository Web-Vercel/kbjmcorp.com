import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {collectionTestOrganization} from '@/lib/collections/test-mode';
export function automaticReleaseEnabled(){return process.env.VERCEL_ENV==='preview'&&process.env.MONTHLY_AUTO_RELEASE_ENABLED==='true';}
const result=z.discriminatedUnion('state',[
 z.object({state:z.literal('published'),jobId:z.uuid(),draftId:z.uuid(),statementId:z.uuid()}),
 z.object({state:z.literal('manual_required'),jobId:z.uuid(),draftId:z.uuid(),reason:z.string()}),
 z.object({state:z.enum(['idle','disabled'])})
]);
/** A missing response is uncertain, never grounds for a second debit or fabricated success. */
export async function runAutomaticRelease(client:SupabaseClient,accountId:string){
 if(!automaticReleaseEnabled())return {state:'disabled'};
 try{const r=await client.rpc('release_automatic_month',{p_account:accountId,p_test_org:collectionTestOrganization()});const parsed=result.safeParse(r.data);if(r.error||!parsed.success)return {state:'unconfirmed'};return parsed.data;}catch{return {state:'unconfirmed'};}
}
