import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
/** Client routes must not inherit an employee session's wider internal RLS access. */
export async function loadClientFinanceScope(client:SupabaseClient,userId:string){
 const result=await client.from('finance_access').select('organization_id').eq('user_id',userId);
 if(result.error)return {ids:[] as string[],error:true};
 return {ids:(result.data||[]).map(row=>row.organization_id as string),error:false};
}
