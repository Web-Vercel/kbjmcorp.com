import type {StatementReadStatus} from '@/lib/billing/statement-read';
import type {CloseOverview} from './month-close';
import type {upstreamPaymentWorkbench} from '@/lib/billing/upstream-payments';
import type {z} from 'zod';
type Payments=z.infer<typeof upstreamPaymentWorkbench>;
export type MainFlowStep={id:string;title:string;state:'ready'|'pending'|'unknown';text:string;target:'funding'|'source'|'settlements'|'access'|'payments'};
export function mainFlow(data:CloseOverview,extras:{financeAccess:boolean|null;payments:Payments|null;clientRead?:StatementReadStatus|null},zh:boolean):MainFlowStep[]{
 const t=(cn:string,en:string)=>zh?cn:en;const all=data.accounts.length>0&&data.accounts.every(a=>a.stage==='published');const posted=data.accounts.filter(a=>a.statement_id);const sources=data.accounts.filter(a=>a.source_ready||a.stage==='published');
 const steps:MainFlowStep[]=[
 {id:'funding',title:t('1. 客户资金与入账','1. Client funds'),state:all||!!data.wallet_id&&BigInt(data.balance_minor)>0n?'ready':'pending',text:all?t('本月已发布账单的客户扣款已记账；原到账及余额可单独核对。','Client charges for posted statements are recorded; verify original receipts and balance separately.'):data.wallet_id?t('检查已入账余额与本期费用；待复核到账不计入余额，余额未预留。','Check posted funds against charges. Pending receipts are excluded and funds are not reserved.'):t('先开立人民币资金账户，再核实客户实际到账。','Open a CNY wallet, then verify incoming client funds.'),target:'funding'},
 {id:'source',title:t('2. 整月广告数据核实','2. Monthly source verification'),state:data.accounts.length>0&&sources.length===data.accounts.length?'ready':'pending',text:t(`已具备核实依据的账户：${sources.length}/${data.accounts.length}。只投放一天也可结算；仍须核实整月范围。`,`Accounts with verified source basis: ${sources.length}/${data.accounts.length}. One active day is enough, but the full month must be verified.`),target:'source'},
 {id:'settlements',title:t('3. 客户账单制单、复核与发布','3. Client statement review and publication'),state:all?'ready':'pending',text:t(`已发布 ${posted.length}/${data.accounts.length} 个账户的月结账单；下方按账户显示当前操作。`,`Published statements for ${posted.length}/${data.accounts.length} accounts. See the current action for each account below.`),target:'settlements'},
 {id:'access',title:t('4. 客户查看与查阅确认','4. Client viewing and acknowledgement'),state:'pending',text:'',target:'access'},
 ];
 const read=extras.clientRead;const idsRead=new Set(posted.map(a=>a.statement_id));const matching=read?.statements.filter(s=>idsRead.has(s.statement_id));const completeRead=!!read&&read.statement_count<=read.statements.length&&matching?.length===posted.length;
 const acknowledged=all&&completeRead&&matching!.every(s=>s.confirmation_count>0&&s.last_confirmed_at!==null);
 steps[3].state=!all?'pending':acknowledged?'ready':!completeRead?'unknown':'pending';
 steps[3].text=!all?t('正式发布后，客户可登录查看账单并提交查阅确认。','After publication, clients can view the statement and acknowledge reading.'):acknowledged?t('已收到本页账单的客户查阅确认；这是客户本人提交的查阅记录。','Client reading acknowledgements received for these statements, submitted by the clients themselves.'):!completeRead?t('客户查阅确认信息尚未完整取得，不能据此认定客户已经确认查阅。','Reading acknowledgement information is incomplete; client acknowledgement cannot be inferred.'):extras.financeAccess===false?t('尚无查阅确认，且未找到当前财务查看授权；请管理员核查客户权限。','No reading acknowledgement and no current finance read authorization; ask an administrator to check access.'):t('尚未收到这些账单的查阅确认，不代表客户从未看过。请客户登录后确认已阅；授权存在不等于已阅。','No reading acknowledgement yet; this does not mean the client has never viewed it. Ask the client to sign in and acknowledge; authorization is not acknowledgement.');
 let state:MainFlowStep['state']='pending',text=t('客户账单发布后，再核对线下 CAD 到账及账单分配。','After client publication, verify offline CAD receipts and allocations.');
 if(posted.length){const p=extras.payments;const ids=new Set(posted.map(a=>a.statement_id));const rows=p?.statements.filter(s=>ids.has(s.id));
 if(!p||p.statement_count>p.statements.length||p.payment_count>p.payments.length||rows?.length!==posted.length){state='unknown';text=t('公司间核对信息未完整取得，不能据此认定已经结清。','Intercompany information is incomplete; settlement cannot be inferred.');}
 else{const involved=p.payments.filter(r=>r.allocations.some(a=>ids.has(a.statement_id)));const pending=rows.some(s=>BigInt(s.pending_cad_minor)>0n)||involved.some(r=>r.reversal_pending);const full=rows.every(s=>BigInt(s.verified_cad_minor)===BigInt(s.procurement_cad_minor));
 state=all&&full&&!pending?'ready':'pending';text=full&&!pending?t('本页已发布账单的采购额均已核销，或采购额为零；这是系统核对状态，不代替银行原件。','Procurement for posted statements is allocated or zero. This system status does not replace bank originals.'):pending?t('仍有到账分配或撤销申请待独立复核，请先处理；尚未核销不代表银行未付款。','Receipt allocations or reversals await independent review. Unreconciled does not mean unpaid at the bank.'):t('仍有采购额尚未核销，请登记已经在线下到账的款项。系统不会自动汇款。','Procurement remains unreconciled. Register receipts already credited offline; the system does not send funds.');}
 }
 steps.push({id:'payments',title:t('5. 公司间到账核对','5. Intercompany receipt verification'),state,text,target:'payments'});return steps;
}
