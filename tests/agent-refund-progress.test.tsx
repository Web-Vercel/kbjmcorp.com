// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import Progress from '@/components/partners/AgentRefundProgress';
const id='d0000000-0000-4000-8000-000000000001';
async function html(data:unknown,error:unknown=null){return renderToStaticMarkup(await Progress({client:{rpc:async()=>({data,error})} as unknown as SupabaseClient,agentId:id,locale:'zh'}));}
it('does not turn unavailable, malformed or wrong-agent progress into an empty queue',async()=>{for(const data of [null,{}, {agentId:'d0000000-0000-4000-8000-000000000002',refunds:[]}])expect(await html(data)).toContain('不能据此认定没有退款');expect(await html({agentId:id,refunds:[]},{message:'PRIVATE'})).not.toContain('PRIVATE');});
it('distinguishes approval from payment and retains the commission hold for another active refund',async()=>{
 const base={id,organization_id:id,company:'FICTIONAL COMPANY',gross_minor:'10001',created_at:'2026-11-16T10:00:00Z',paid_at:null,commission_paused:true};
 const approved=await html({agentId:id,refunds:[{...base,status:'approved'}]});expect(approved).toContain('已批准 · 待线下退款');expect(approved).toContain('CNY 100.01');expect(approved).toContain('相关佣金暂停结算');
 const cancelled=await html({agentId:id,refunds:[{...base,status:'cancelled'}]});expect(cancelled).toContain('该客户仍有退款处理中');
 const paid=await html({agentId:id,refunds:[{...base,status:'paid',commission_paused:false}]});expect(paid).toContain('佣金是否调整须按协议核算');expect(paid).toContain('已付佣金不会自动追回');
});

it('presents the hold as a conditional rule when all displayed refunds are cancelled',async()=>{
 const result=await html({agentId:id,refunds:[{id,organization_id:id,company:'FICTIONAL',gross_minor:'1000',status:'cancelled',created_at:'2026-11-16T10:00:00Z',paid_at:null,commission_paused:false}]});
 expect(result).toContain('佣金规则：仅按符合约定的已结算金额计佣');expect(result).not.toContain('退款处理中，相关客户佣金暂停结算。');expect(result).not.toContain('不再因本次申请暂停佣金结算');
});
