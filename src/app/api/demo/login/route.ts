import {z} from 'zod';
import {authResponse,readAuthBody} from '@/lib/auth/http';
import {consumeAuthLimit} from '@/lib/auth/rate-limit';
import {demoConfig,demoLogin,demoCookie} from '@/lib/demo/session';
export async function POST(request:Request){
 const input=await readAuthBody(request);if(input.error)return input.error;
 const parsed=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),password:z.string().min(1).max(256)}).safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_credentials'},401);
 if(!demoConfig())return authResponse({error:'unavailable'},503);
 try{const wait=await consumeAuthLimit(parsed.data.username,'demo');if(wait)return authResponse({error:'rate_limited'},429,wait);
 const result=await demoLogin(parsed.data.username,parsed.data.password);if(!result)return authResponse({error:'invalid_credentials'},401);
 const response=authResponse({ok:true});response.cookies.set(demoCookie,result.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*3600});return response;
 }catch{return authResponse({error:'unavailable'},503);}
}
