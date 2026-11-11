import 'server-only';
import {authClient} from '@/lib/auth/server';
import {liveContext} from './model';
export async function getLiveContext(mfa=true){
 const client=await authClient(true);if(!client)return {error:'unavailable' as const,status:503};
 try{const {data,error}=await client.auth.getUser();if(error||!data.user)return {error:'unauthenticated' as const,status:401};const result=await client.rpc('get_live_account_context',{p_mfa:false});const parsed=liveContext.safeParse(result.data);if(result.error||!parsed.success||parsed.data.user_id!==data.user.id)return {error:'forbidden' as const,status:403};if(mfa){const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=='aal2')return {error:'mfa_required' as const,status:403};}return {client,user:data.user,context:parsed.data};}catch{return {error:'unavailable' as const,status:503};}
}
