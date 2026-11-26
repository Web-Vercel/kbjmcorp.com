import {additionalReportingConnections} from '@/lib/ads/reporting-connections';
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
 const legacy=reportingConfig();const extra=additionalReportingConnections().connections.filter(c=>c.key);
 const connections=[...(legacy?[legacy]:[]),...extra.map(c=>({key:c.key!,accountId:c.accountId,currency:c.currency||null}))];
 const connection=getPrivilegedConnection();if(!connection||!connections.length)return authResponse({error:'not_configured'},503);
 try{const client=createClient(connection.url,connection.key,{auth:{persistSession:false,autoRefreshToken:false}});// One bounded batch of two accounts; rotate daily so a failing account cannot starve others.
 const offset=Math.floor(Date.now()/86400000)%connections.length;
 const selected=Array.from({length:Math.min(2,connections.length)},(_,i)=>connections[(offset+i)%connections.length]);
 const results=await Promise.all(selected.map(c=>connections.length===1&&legacy?runMonthlyAutomation(client):runMonthlyAutomation(client,c).catch(()=>({state:'unconfirmed'}))));
 const result=results.find(r=>r.state==='unconfirmed')||results.find(r=>r.state==='prepared')||results.find(r=>r.state==='retry')||results[0];
 return authResponse({ok:true,...result,...(connections.length>1?{accounts:results.map((r,i)=>({accountId:selected[i].accountId,...r}))}:{})},result.state==='unconfirmed'?503:200);}catch{return authResponse({error:'worker_unavailable'},503);}
}
