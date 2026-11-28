import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {money} from '@/lib/billing/model';
export default async function StatementAdjustments({client,statementId,locale}:{client:SupabaseClient;statementId:string;locale:'zh'|'en'}){
 const zh=locale==='zh';const r=await client.rpc('get_client_statement_adjustments',{p_statement:statementId});const parsed=z.array(z.object({id:z.uuid(),statement_id:z.literal(statementId),amount_minor:z.string().regex(/^-?\d+$/),published_at:z.string()})).safeParse(r.data);
 if(r.error||!parsed.success)return <p role="alert">{zh?'账单调整记录暂不可用，请稍后核查。':'Statement adjustment records unavailable; check again later.'}</p>;
 if(!parsed.data.length)return null;
 return <section><h3>{zh?'关联调整单（原账单保留）':'Related adjustments (original bill retained)'}</h3>{parsed.data.map(a=><p key={a.id}>{BigInt(a.amount_minor)>0?(zh?'补收':'Supplemental charge'):BigInt(a.amount_minor)<0?(zh?'退回预付余额':'Credit to prepaid balance'):(zh?'无需金额调整':'No monetary change')} · {money((BigInt(a.amount_minor)<0?-BigInt(a.amount_minor):BigInt(a.amount_minor)).toString(),'CNY',locale)} · {zh?'调整单编号：':'Adjustment ID: '}{a.id}</p>)}</section>;
}
