import {authResponse,readAuthBody} from '@/lib/auth/http';
import {demoCookie} from '@/lib/demo/session';
export async function POST(request:Request){const input=await readAuthBody(request);if(input.error)return input.error;const response=authResponse({ok:true});response.cookies.set(demoCookie,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});return response;}
