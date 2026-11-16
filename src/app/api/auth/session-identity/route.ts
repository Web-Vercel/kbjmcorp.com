import {authClient} from '@/lib/auth/server';
import {authResponse} from '@/lib/auth/http';
export const dynamic='force-dynamic';
/** Read-only identity of the current cookie, never a requested user or company. */
export async function GET(){
 try{const client=await authClient();if(!client)return authResponse({error:'unavailable'},503);const result=await client.auth.getUser();if(result.error||!result.data.user)return authResponse({error:'unauthenticated'},401);return authResponse({userId:result.data.user.id,email:result.data.user.email||null});}
 catch{return authResponse({error:'unavailable'},503);}
}
