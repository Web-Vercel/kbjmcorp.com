import type {RefundWorkspace} from '@/lib/partners/model';
import {refundChecks} from '@/lib/partners/refund-checks';
export default function RefundChecks({data}:{data:RefundWorkspace}){
 const rows=data.refunds.map(refund=>({refund,issues:refundChecks(refund,data.payments)}));
 const pending=rows.filter(r=>r.issues.length>0);
 const incomplete=data.refunds.length>=200||data.payments.length>=200;
 if(!pending.length&&!incomplete)return null;
 return <section className="admin-panel" aria-labelledby="refund-checks-title"><h2 id="refund-checks-title">退款记录需核实</h2>{incomplete&&<p role="alert">记录达到显示上限，以下仅检查本页数据，不能据此确认全部退款已核对。</p>}{pending.length>0&&<ul>{pending.map(({refund,issues})=><li key={refund.id}><a href={`#refund-${refund.id}`}>{refund.company} · 查看申请</a><><strong> · 需要核实</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul><p>先核对申请、付款登记及银行原流水，再决定如何处理。</p></></li>)}</ul>}</section>;
}
