import {z} from 'zod';
import {getClientTestLoginConfig} from '@/lib/auth/client-test-config';
import {authClient} from '@/lib/auth/server';
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
import {authResponse,readAuthBody} from '@/lib/auth/http';
const schema=z.object({email:z.email().max(254),password:z.string().min(1).max(256),captchaToken:z.string().min(1).max(4096)});
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const config=getClientTestLoginConfig();if(!config)return authResponse({error:'not_available'},404);
 const parsed=schema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 let client:Awaited<ReturnType<typeof authClient>>=null;
 try{
  const wait=await consumeAuthLimit(parsed.data.email.trim().toLowerCase(),'client_test');
  if(wait)return authResponse({error:'rate_limited'},429,wait);
  client=await authClient(true);if(!client)return authResponse({error:'unavailable'},503);
  const result=await client.auth.signInWithPassword({email:parsed.data.email,password:parsed.data.password,options:{captchaToken:parsed.data.captchaToken}});
  const user=result.data.user;
  if(result.error||!user){await client.auth.signOut({scope:'local'});return authResponse({error:'invalid_credentials'},401);}
  const reject=async(status=401)=>{if(client)await client.auth.signOut({scope:'local'});return authResponse({error:status===503?'unavailable':'invalid_credentials'},status);};
  if(!user.email_confirmed_at||!config.allowedUserIds.includes(user.id))return await reject();
  const [employee,memberships]=await Promise.all([
   client.from('staff_members').select('user_id').eq('user_id',user.id).maybeSingle(),
   client.from('memberships').select('organization_id').eq('user_id',user.id).limit(2),
  ]);
  if(employee.error||memberships.error)return await reject(503);
  // Exactly one approved company per test identity. Never grant or infer membership here.
  if(employee.data||memberships.data?.length!==1)return await reject();
  return authResponse({ok:true});
 }catch{if(client){try{await client.auth.signOut({scope:'local'});}catch{/* Fail closed without revealing Auth details. */}}return authResponse({error:'unavailable'},503);}
}
