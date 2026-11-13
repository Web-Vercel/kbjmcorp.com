import {z} from 'zod';
import {upstreamPaymentWorkbench} from '@/lib/billing/upstream-payments';
import {fundsAmount} from '@/lib/billing/monthly-funds';
import {statementPublishedAt} from '@/lib/billing/client-statement';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/),month=z.iso.date().refine(v=>v.endsWith('-01'));
const statement=z.object({id:z.uuid(),account_name:z.string().max(1000),procurement_minor:minor,verified_minor:minor,pending_minor:minor,remaining_minor:minor});
const registration=z.object({id:z.uuid(),revision:z.number().int().positive(),bank_reference:z.string().max(160),received_on:z.iso.date(),registered_minor:minor,selected_minor:minor,other_month_minor:minor,status:z.enum(['pending','approved','rejected']),reversed:z.boolean(),reversal_pending:z.boolean(),registered_at:z.iso.datetime({offset:true}),reviewed_at:z.iso.datetime({offset:true}).nullable()});
const allocation=z.object({payment_id:z.uuid(),statement_id:z.uuid(),amount_minor:minor,verified_minor:minor,pending_minor:minor});
export const cadAllocationReportSchema=z.object({organization_id:z.uuid(),organization_name:z.string().min(1).max(500),month,generated_at:z.iso.datetime({offset:true}),procurement_minor:minor,verified_minor:minor,pending_minor:minor,remaining_minor:minor,pending_reversal_count:z.number().int().nonnegative(),statements:statement.array().max(200),registrations:registration.array().max(100),allocations:allocation.array().max(2000)});
export type CadAllocationReport=z.infer<typeof cadAllocationReportSchema>;
export function buildCadAllocationReport(input:{organizationId:string;organizationName:string;month:string;data:unknown;generatedAt:string}):CadAllocationReport|null{
 const parsed=upstreamPaymentWorkbench.safeParse(input.data);if(!parsed.success)return null;const d=parsed.data;
 if(!d.reversal_enabled||d.statement_count!==d.statements.length||d.payment_count!==d.payments.length||new Set(d.statements.map(s=>s.id)).size!==d.statements.length||new Set(d.payments.map(p=>p.id)).size!==d.payments.length)return null;
 if(d.statements.some(s=>s.month!==input.month||BigInt(s.verified_cad_minor)>BigInt(s.procurement_cad_minor)))return null;
 const byId=new Map(d.statements.map(s=>[s.id,s]));const allocations:z.infer<typeof allocation>[]=[],registrations:z.infer<typeof registration>[]=[];
 for(const p of d.payments){
 if(!p.allocations.length||new Set(p.allocations.map(a=>a.statement_id)).size!==p.allocations.length||p.reversed&&p.reversal_pending||(p.reversed||p.reversal_pending)&&p.status!=='approved')return null;
 const all=p.allocations.reduce((sum,a)=>sum+BigInt(a.amount_cad_minor),0n),selected=p.allocations.filter(a=>a.month===input.month);
 if(all!==BigInt(p.received_cad_minor)||all<=0n||p.allocations.some(a=>BigInt(a.amount_cad_minor)<=0n||!a.month.endsWith('-01'))||!selected.length)return null;
 if(p.allocations.some(a=>byId.has(a.statement_id)&&a.month!==input.month)||selected.some(a=>!byId.has(a.statement_id)))return null;
 const total=selected.reduce((sum,a)=>sum+BigInt(a.amount_cad_minor),0n);
 registrations.push({id:p.id,revision:p.revision,bank_reference:p.bank_reference,received_on:p.received_on,registered_minor:p.received_cad_minor,selected_minor:total.toString(),other_month_minor:(all-total).toString(),status:p.status,reversed:p.reversed,reversal_pending:p.reversal_pending,registered_at:p.prepared_at,reviewed_at:p.reviewed_at});
 for(const a of selected)allocations.push({payment_id:p.id,statement_id:a.statement_id,amount_minor:a.amount_cad_minor,verified_minor:p.status==='approved'&&!p.reversed?a.amount_cad_minor:'0',pending_minor:p.status==='pending'?a.amount_cad_minor:'0'});
 }
 const statements:z.infer<typeof statement>[]=d.statements.map(s=>({id:s.id,account_name:s.account_name,procurement_minor:s.procurement_cad_minor,verified_minor:s.verified_cad_minor,pending_minor:s.pending_cad_minor,remaining_minor:(BigInt(s.procurement_cad_minor)-BigInt(s.verified_cad_minor)).toString()}));
 for(const s of statements){const own=allocations.filter(a=>a.statement_id===s.id);if(own.reduce((n,a)=>n+BigInt(a.verified_minor),0n)!==BigInt(s.verified_minor)||own.reduce((n,a)=>n+BigInt(a.pending_minor),0n)!==BigInt(s.pending_minor))return null;}
 const sum=(key:'procurement_minor'|'verified_minor'|'pending_minor'|'remaining_minor')=>statements.reduce((n,s)=>n+BigInt(s[key]),0n).toString();
 const report=cadAllocationReportSchema.safeParse({organization_id:input.organizationId,organization_name:input.organizationName,month:input.month,generated_at:input.generatedAt,procurement_minor:sum('procurement_minor'),verified_minor:sum('verified_minor'),pending_minor:sum('pending_minor'),remaining_minor:sum('remaining_minor'),pending_reversal_count:registrations.filter(r=>r.reversal_pending).length,statements,registrations,allocations});return report.success?report.data:null;
}
export function registrationStatus(r:CadAllocationReport['registrations'][number],zh:boolean){return r.reversed?(zh?'原核销已撤销，保留历史':'Reversed; history retained'):r.status==='approved'?(zh?'已独立复核，计入核销':'Independently approved; counted'):r.status==='rejected'?(zh?'已退回，不计入核销':'Rejected; excluded'):(zh?'待复核，不计入已核销':'Pending review; not verified');}
const cell=(v:string)=>`"${(/^[\s\uFEFF]*[=+\-@]/.test(v)?"'"+v:v).replaceAll('"','""')}"`;
export function cadAllocationReportCsv(input:CadAllocationReport,zh:boolean){
 const s=cadAllocationReportSchema.parse(input);if(!s.statements.length)throw new Error('No posted procurement statements');const t=(cn:string,en:string)=>zh?cn:en;const statements=new Map(s.statements.map(x=>[x.id,x])),registrations=new Map(s.registrations.map(x=>[x.id,x]));
 const rows=[
 [t('公司间CAD核销报告（内部）','Internal intercompany CAD allocation report')],
 [t('说明','Notice'),t('按采购账单月份核销，非银行付款证明、客户账单或自动结清凭证。没有未核销金额不代表客户已阅或同意收费。系统不汇款，不再次扣客户余额。','By procurement statement month, not bank payment proof, a client bill or an automatic settlement certificate. Zero unreconciled does not establish client reading or fee agreement. No remittance or client debit is initiated.')],
 [t('企业','Company'),s.organization_name],[t('企业编号','Company ID'),s.organization_id],[t('采购账单月份','Procurement statement month'),s.month.slice(0,7)],[t('报告生成时间（温哥华）','Generated at (Vancouver)'),statementPublishedAt(s.generated_at,zh)],
 [t('采购合计 CAD','Procurement total CAD'),fundsAmount(s.procurement_minor)],[t('已独立复核核销 CAD','Verified allocation CAD'),fundsAmount(s.verified_minor)],[t('尚未核销 CAD','Unreconciled CAD'),fundsAmount(s.remaining_minor)],[t('待复核分配 CAD（不预留）','Pending allocation CAD (not reserved)'),fundsAmount(s.pending_minor)],[t('待复核撤销批次','Batches with pending reversal'),String(s.pending_reversal_count)],
 [t('跨月与版本口径','Cross-month and revision basis'),t('整笔登记净到账可能分配到多个月份，仅本月账单的有效分配计入本月核销。批次含已退回/已撤销历史版本，不可把登记净到账列相加作为本月付款。撤销待复核时原核销仍保留，批准撤销后才排除。','A whole registered receipt can cover multiple months. Only effective allocations to this month count. Batches include rejected/reversed revisions; do not sum whole registered receipts as monthly payments. Pending reversals retain the original allocation until approval.')],
 [],[t('本月采购账单明细','Procurement statements this month')],
 zh?['账单编号','广告账户','采购额 CAD','已复核核销 CAD','尚未核销 CAD','待复核分配 CAD']:['Statement ID','Advertiser','Procurement CAD','Verified CAD','Unreconciled CAD','Pending CAD'],
 ...s.statements.map(x=>[x.id,x.account_name,fundsAmount(x.procurement_minor),fundsAmount(x.verified_minor),fundsAmount(x.remaining_minor),fundsAmount(x.pending_minor)]),
 [],[t('涉及本月的到账登记批次（整笔参考，不汇总为本月付款）','Receipt registrations involving this month (whole receipt reference, not monthly payments)')],
 zh?['登记编号','银行参考号','版本','登记到账日期','登记整笔净到账 CAD','分配本月 CAD','分配其他月份 CAD','核对状态','撤销待复核','登记时间（温哥华）','复核时间（温哥华）']:['Registration ID','Bank reference','Revision','Registered receipt date','Whole registered CAD','Allocated to this month CAD','Other months CAD','Review status','Reversal pending','Registered (Vancouver)','Reviewed (Vancouver)'],
 ...s.registrations.map(r=>[r.id,r.bank_reference,String(r.revision),r.received_on,fundsAmount(r.registered_minor),fundsAmount(r.selected_minor),fundsAmount(r.other_month_minor),registrationStatus(r,zh),r.reversal_pending?t('是','Yes'):t('否','No'),statementPublishedAt(r.registered_at,zh),r.reviewed_at?statementPublishedAt(r.reviewed_at,zh):'']),
 [],[t('本月逐笔分配（不含其他月份明细）','Individual allocations for this month only')],
 zh?['登记编号','银行参考号','版本','账单编号','广告账户','分配金额 CAD','计入已核销 CAD','待复核分配 CAD']:['Registration ID','Bank reference','Revision','Statement ID','Advertiser','Allocated CAD','Counted verified CAD','Pending CAD'],
 ...s.allocations.map(a=>[a.payment_id,registrations.get(a.payment_id)?.bank_reference||'',String(registrations.get(a.payment_id)?.revision||''),a.statement_id,statements.get(a.statement_id)?.account_name||'',fundsAmount(a.amount_minor),fundsAmount(a.verified_minor),fundsAmount(a.pending_minor)]),
 [],[t('留档口径','Archive basis'),t('仅为查询时点的系统核对记录，文件不自动更新。含银行参考号，仅供获授权内部财务使用；原件、人员身份、说明和内部汇率不在本文件中。','Query-time system records; this file does not update automatically. Contains bank references for authorized internal finance only. Originals, actor identities, notes and internal FX are excluded.')],
 ];return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
