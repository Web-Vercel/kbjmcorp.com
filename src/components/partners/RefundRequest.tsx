'use client';
import {useState} from 'react';
import ActionForm from './ActionForm';
import {parseAmount,feeFor,displayAmount,type RefundWorkspace} from '@/lib/partners/model';
export default function RefundRequest({wallet}:{wallet:RefundWorkspace['wallets'][number]}){
 const [amount,setAmount]=useState('');const policy=wallet.policy;if(!policy)return <div><button className="button" type="button" disabled aria-describedby={`refund-unavailable-${wallet.id}`}>申请退款（待确认手续费）</button><p id={`refund-unavailable-${wallet.id}`}>尚未登记退款手续费约定，请先联系业务人员确认。</p></div>;
 let gross=0n,fee=0n;try{gross=parseAmount(amount);fee=feeFor(gross,policy);}catch{/* Incomplete input has no quote. */}
 const valid=gross>fee&&gross<=BigInt(wallet.available_minor);
 return <details><summary>申请退还余额</summary><p>可申请上限 CNY {displayAmount(wallet.available_minor)}。这是扣除退款占用及已复核未发布草稿后的余额；其他尚未出账费用仍需财务核实。</p><p>约定：{policy.agreement}</p><p>手续费：{policy.mode==='fixed'?`固定 CNY ${displayAmount(String(policy.value))}`:`申请金额的 ${policy.value/100}%` }，四舍五入至分。申请金额包含手续费。</p><ActionForm action="refund_request" disabled={!valid} data={{walletId:wallet.id,policyId:policy.id,amountMinor:gross.toString()}} button="提交退款申请（先占用，不立即退款）" noteLabel="退款原因"><label>申请退余额金额（CNY，含手续费）<input required name="displayAmount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" pattern="[0-9]{1,8}(\.[0-9]{1,2})?"/></label>{valid?<p role="status">申请 CNY {displayAmount(gross)} − 手续费 CNY {displayAmount(fee)} ＝ 预计实退 CNY {displayAmount(gross-fee)}</p>:<p>请填写不超过可申请上限、且扣除手续费后大于零的金额。</p>}<label><input name="accepted" type="checkbox" required/>我同意上述手续费约定，知悉实际退款还需核对未结费用、收款人及独立复核。本次申请不会立即转账。</label><input type="hidden" name="amountMinor" value={gross.toString()}/></ActionForm></details>;
}
