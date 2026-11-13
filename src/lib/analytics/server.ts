import 'server-only';
import {getLiveContext} from '@/lib/live-access/server';
import {analyticsData,analyticsQuery,defaultRange} from './model';
export async function readAnalytics(query:{from?:string;until?:string;company?:string}){
 const c=await getLiveContext();if('error'in c)return {error:c.error==='forbidden'?'access_unavailable' as const:c.error||'unavailable' as const,status:c.status||503};
 const p=analyticsQuery.safeParse({...defaultRange(),...Object.fromEntries(Object.entries(query).filter(([,v])=>v!==undefined&&v!==''))});if(!p.success)return {error:'invalid_range' as const,status:400};
 const scope=c.context.role==='investor'?p.data.company||null:c.context.organization_id;
 if(c.context.role!=='investor'&&p.data.company&&p.data.company!==scope)return {error:'forbidden' as const,status:403};
 try{const r=await c.client.rpc('get_business_analytics',{p_from:p.data.from,p_until:p.data.until,p_org:scope});const parsed=analyticsData.safeParse(r.data);
 if(r.error||!parsed.success)return {error:r.error?.code==='54000'?'range_too_large' as const:'unavailable' as const,status:503};
 const d=parsed.data;if(d.userId!==c.user.id||d.role!==c.context.role||d.scopeId!==scope||d.from!==p.data.from||d.until!==p.data.until)return {error:'unavailable' as const,status:503};
 if(d.role==='investor'&&d.daily.some(v=>v.spendMicros===null||v.currency===null))return {error:'unavailable' as const,status:503};
 if(d.role==='sales'&&(d.daily.length||d.statements.length||d.cash.length||d.balances.length))return {error:'unavailable' as const,status:503};
 if(d.role!=='investor'&&d.companies.some(v=>v.id!==scope))return {error:'unavailable' as const,status:503};
 if(d.role==='client'&&(d.pipeline.length||d.projects.length||d.service.length||d.followups.length||d.daily.some(r=>r.companyId!==scope||r.spendMicros!==null||r.currency!==null||r.status!=='published')||d.statements.some(r=>r.companyId!==scope)||d.balances.some(r=>r.companyId!==scope)))return {error:'unavailable' as const,status:503};
 return {data:d,context:c.context};
 }catch{return {error:'unavailable' as const,status:503};}
}
