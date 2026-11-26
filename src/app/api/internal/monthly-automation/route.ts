import {timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {getPrivilegedConnection} from '@/lib/auth/privileged-config';
import {reportingConfig} from '@/lib/ads/report-client';
import {runMonthlyAutomation} from '@/lib/billing/monthly-worker';
import {authResponse} from '@/lib/auth/http';
export const maxDuration=60;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 const received=request.headers.get('authorization')||'';
 if(!secret||secret.length<32)return authResponse({error:'unavailable'},503);
 const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(received);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return authResponse({error:'forbidden'},403);
 if(process.env.VERCEL_ENV!=='preview'||process.env.MONTHLY_AUTOMATION_ENABLED!=='true')return authResponse({ok:true,state:'disabled'});
 const connection=getPrivilegedConnection();if(!connection||!reportingConfig())return authResponse({error:'not_configured'},503);
 try{const client=createClient(connection.url,connection.key,{auth:{persistSession:false,autoRefreshToken:false}});const result=await runMonthlyAutomation(client);return authResponse({ok:true,...result},result.state==='unconfirmed'?503:200);}catch{return authResponse({error:'worker_unavailable'},503);}
}
