import type {RefundWorkspace} from './model';
type Refund=RefundWorkspace['refunds'][number];
type Payment=RefundWorkspace['payments'][number];
export function refundChecks(refund:Refund,payments:Payment[]){
 const issues:string[]=[];
 if(BigInt(refund.gross_minor)!==BigInt(refund.fee_minor)+BigInt(refund.net_minor))issues.push('申请金额与手续费、实退金额不一致');
 const related=payments.filter(p=>p.kind==='refund'&&p.target_id===refund.id);
 const active=related.filter(p=>p.status!=='rejected');
 if(active.length>1)issues.push('同一申请存在多笔有效付款记录');
 if(active.some(p=>BigInt(p.amount_minor)!==BigInt(refund.net_minor)))issues.push('付款登记金额与应退金额不一致');
 if(refund.status==='payment_pending'&&!active.some(p=>p.status==='pending'))issues.push('待核实付款缺少对应的有效付款登记');
 if(refund.status==='paid'&&!active.some(p=>p.status==='verified'))issues.push('已付款申请缺少已核实的付款记录');
 if(active.some(p=>p.status==='verified')&&refund.status!=='paid')issues.push('付款已核实，但申请状态尚未对应');
 if(active.some(p=>p.status==='pending')&&refund.status!=='payment_pending')issues.push('付款待核实，但申请状态尚未对应');
 if(related.some(p=>p.status==='rejected')&&refund.status!=='paid')issues.push('付款登记曾被退回，先核实原银行流水，勿重复付款');
 return issues;
}
export function refundNext(refund:Refund){
 switch(refund.status){
 case 'requested':return '制单员核算未结费用与可退金额';
 case 'prepared':return '另一位财务人员独立复核';
 case 'reviewed':return '管理员批准退款安排';
 case 'approved':return '财务确认线下实际付款后登记';
 case 'payment_pending':return '另一位财务人员核实原付款流水，勿重复付款';
 case 'paid':return '已核实付款，保留记录';
 case 'rejected':return '已退回，客户核实说明后决定是否重新申请';
 case 'cancelled':return '已取消，保留记录';
 }
}
