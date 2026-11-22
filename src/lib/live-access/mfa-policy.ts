import type {SupabaseClient} from '@supabase/supabase-js';
import {liveContext} from './model';
/** An old database must keep requiring MFA until the investor-only migration is applied. */
export async function requiresLiveMfa(client:SupabaseClient,role:string,userId:string){
 if(role==='client'||role==='agent')return false;
 if(role!=='investor')return true;
 try{const r=await client.rpc('get_live_account_context',{p_mfa:true});const p=liveContext.safeParse(r.data);return !!r.error||!p.success||p.data.user_id!==userId||p.data.role!=='investor';}catch{return true;}
}
