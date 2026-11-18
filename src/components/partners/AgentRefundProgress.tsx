import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {displayAmount} from '@/lib/partners/model';
import {formatDate} from '@/lib/admin/content';
const schema=z.object({agentId:z.uuid(),refunds:z.array(z.object({id:z.uuid(),organization_id:z.uuid(),company:z.string(),gross_minor:z.string().regex(/^\d+$/),status:z.enum(['requested','prepared','reviewed','approved','payment_pending','paid','rejected','cancelled']),created_at:z.string(),paid_at:z.string().nullable(),commission_paused:z.boolean()}))});
const labels={requested:'客户已申请 · 待核算',prepared:'待独立复核',reviewed:'已复核 · 待批准',approved:'已批准 · 待线下退款',payment_pending:'已登记退款 · 待核实',paid:'退款已核实完成',rejected:'申请已退回',cancelled:'申请已取消'};
export default async function AgentRefundProgress({client,agentId,locale}:{client:SupabaseClient;agentId:string;locale:'zh'|'en'}){
 const result=await client.rpc('read_agent_refund_progress');const parsed=schema.safeParse(result.data);
 return <section className="admin-panel" aria-label="关联客户退款动态"><h2>关联客户退款动态</h2>{result.error||!parsed.success||parsed.data.agentId!==agentId?<p role="alert">退款进度暂不可用，请稍后刷新或联系业务人员；不能据此认定没有退款或佣金可结算。</p>:<><p>佣金规则：客户有退款处理中时，相关佣金暂停结算；申请取消或退回后，仍须满足等待期、复核和调整要求。批准不代表已退款，部分退款不自动取消全部佣金。</p>{!parsed.data.refunds.length?<p>暂无可查看的关联退款记录。</p>:<><p className="workflow-byline">最近100条</p>{parsed.data.refunds.map(r=><article className="admin-project" key={r.id}><h3 data-workspace-value>{r.company}</h3><p>{labels[r.status]}</p><p>申请金额：<span data-workspace-value>CNY {displayAmount(r.gross_minor)}</span> · 申请时间：<span data-workspace-value>{formatDate(r.created_at,locale)}</span></p><p>{r.commission_paused?'该客户仍有退款处理中，相关佣金暂停结算。':r.status==='paid'?'本次退款已完成；佣金是否调整须按协议核算，已付佣金不会自动追回。':'本次申请已结束，不再因本次申请暂停佣金结算。'}</p>{r.paid_at&&<p>核实完成：<span data-workspace-value>{formatDate(r.paid_at,locale)}</span></p>}</article>)}</>}</>}<details><summary>佣金处理说明</summary><p>退款暂停不等于佣金取消。核算人员按退款涉及的业务及代理协议登记调整，再由另一人复核。历史付款保留。</p></details></section>;
}
