import {monthFunding,monthFundingSchema,fundingDescription} from './month-funding';
import {z} from 'zod';
import {closeStages} from './month-close';
import {upstreamPaymentWorkbench} from '@/lib/billing/upstream-payments';
import {statementReadStatus} from '@/lib/billing/statement-read';
import {statementQuestionWorkbench} from './statement-questions';
import {fundsAmount} from '@/lib/billing/monthly-funds';
import {statementPublishedAt} from '@/lib/billing/client-statement';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/),signed=z.string().regex(/^-?(0|[1-9]\d{0,29})$/);
const date=z.iso.date().refine(v=>v.endsWith('-01'));
const timestamp=z.iso.datetime({offset:true});
const stage=z.enum(Object.keys(closeStages) as [keyof typeof closeStages,...(keyof typeof closeStages)[]]);
const baseAccount=z.object({binding_id:z.uuid(),account_id:z.string().max(160),account_label:z.string().max(1000),timezone:z.string().max(100).nullable(),stage,source_id:z.uuid().nullable(),source_ready:z.boolean(),draft_id:z.uuid().nullable(),draft_total_cny_minor:minor.nullable(),statement_id:z.uuid().nullable(),published_at:timestamp.nullable(),posted_total_cny_minor:minor.nullable()});
const overview=z.object({organization_id:z.uuid(),month:date,wallet_id:z.uuid().nullable(),balance_minor:signed,pending_receipt_count:z.number().int().nonnegative(),pending_receipt_minor:minor,accounts:baseAccount.array().max(1000)});
const row=baseAccount.extend({confirmation_count:z.number().int().nonnegative().nullable(),last_confirmed_at:timestamp.nullable(),procurement_cad_minor:minor.nullable(),verified_cad_minor:minor.nullable(),pending_cad_minor:minor.nullable(),reversal_pending:z.boolean().nullable()});
export const monthCloseChecklistSchema=z.object({organization_id:z.uuid(),organization_name:z.string().min(1).max(500),month:date,generated_at:timestamp,wallet_id:z.uuid().nullable(),balance_minor:signed.nullable(),pending_receipt_count:z.number().int().nonnegative(),pending_receipt_minor:minor.nullable(),funding:monthFundingSchema,questions:z.object({total_count:z.number().int().nonnegative(),open_count:z.number().int().nonnegative(),in_progress_count:z.number().int().nonnegative(),resolved_count:z.number().int().nonnegative()}),accounts:row.array().min(1).max(1000)});
export type MonthCloseChecklist=z.infer<typeof monthCloseChecklistSchema>;
// Project and validate on the server. Raw payment evidence, actor IDs and CRM contacts
// must never be passed to the client-side download component.
export function buildMonthCloseChecklist(input:{organizationId:string;organizationName:string;month:string;overview:unknown;payments:unknown;reads:unknown;questions:unknown;generatedAt:string}):MonthCloseChecklist|null{
 const parsed=overview.safeParse(input.overview),questions=statementQuestionWorkbench.safeParse(input.questions);
 if(!parsed.success||!questions.success||!timestamp.safeParse(input.generatedAt).success)return null;
 const data=parsed.data,q=questions.data;const funding=monthFunding(input.overview,{organizationId:input.organizationId,month:input.month});if(!funding)return null;
 if(data.organization_id!==input.organizationId||data.month!==input.month||q.organization_id!==data.organization_id||q.month!==data.month||!data.accounts.length)return null;
 if(new Set(data.accounts.map(a=>a.binding_id)).size!==data.accounts.length)return null;
 const posted=data.accounts.filter(a=>a.stage==='published');
 if(data.accounts.some(a=>a.stage==='published'?(!a.statement_id||!a.source_id||!a.draft_id||a.posted_total_cny_minor===null||!a.published_at):a.statement_id!==null||a.posted_total_cny_minor!==null||a.published_at!==null))return null;
 if(new Set(posted.map(a=>a.statement_id)).size!==posted.length||data.accounts.some(a=>(a.draft_id===null)!==(a.draft_total_cny_minor===null)||a.stage==='published'&&a.draft_total_cny_minor!==a.posted_total_cny_minor))return null;
 const payments=posted.length?upstreamPaymentWorkbench.safeParse(input.payments):null,reads=posted.length?statementReadStatus.safeParse(input.reads):null;
 if(posted.length&&(!payments?.success||!reads?.success))return null;
 const p=payments?.success?payments.data:null,r=reads?.success?reads.data:null;
 if(p&&r){
 if(new Set(p.payments.map(x=>x.id)).size!==p.payments.length||p.payments.some(x=>!x.allocations.some(v=>v.month===data.month&&posted.some(a=>a.statement_id===v.statement_id))))return null;
 if(!p.reversal_enabled||p.statement_count!==posted.length||p.statements.length!==posted.length||p.payment_count!==p.payments.length||new Set(p.statements.map(s=>s.id)).size!==posted.length||r.statement_count!==posted.length||r.statements.length!==posted.length||new Set(r.statements.map(s=>s.statement_id)).size!==posted.length)return null;
 if(posted.some(a=>!p.statements.some(s=>s.id===a.statement_id&&s.month===data.month)||!r.statements.some(s=>s.statement_id===a.statement_id)))return null;
 if(p.statements.some(s=>BigInt(s.verified_cad_minor)>BigInt(s.procurement_cad_minor))||r.statements.some(s=>(s.confirmation_count===0)!==(s.last_confirmed_at===null)))return null;
 for(const statement of p.statements){let verified=0n,pending=0n;for(const payment of p.payments){for(const allocation of payment.allocations.filter(a=>a.statement_id===statement.id)){if(payment.status==='approved'&&!payment.reversed)verified+=BigInt(allocation.amount_cad_minor);if(payment.status==='pending')pending+=BigInt(allocation.amount_cad_minor);}}if(verified!==BigInt(statement.verified_cad_minor)||pending!==BigInt(statement.pending_cad_minor))return null;}
 }
 const result=monthCloseChecklistSchema.safeParse({organization_id:data.organization_id,organization_name:input.organizationName,month:data.month,generated_at:input.generatedAt,wallet_id:data.wallet_id,balance_minor:data.wallet_id?data.balance_minor:null,pending_receipt_count:data.pending_receipt_count,pending_receipt_minor:data.wallet_id?data.pending_receipt_minor:null,
 funding,questions:{total_count:q.total_count,open_count:q.open_count,in_progress_count:q.in_progress_count,resolved_count:q.resolved_count},accounts:data.accounts.map(a=>{
 const payment=p?.statements.find(s=>s.id===a.statement_id),read=r?.statements.find(s=>s.statement_id===a.statement_id);
 return {...a,confirmation_count:read?.confirmation_count??null,last_confirmed_at:read?.last_confirmed_at??null,procurement_cad_minor:payment?.procurement_cad_minor??null,verified_cad_minor:payment?.verified_cad_minor??null,pending_cad_minor:payment?.pending_cad_minor??null,reversal_pending:payment&&p?p.payments.some(x=>x.reversal_pending&&x.allocations.some(v=>v.statement_id===a.statement_id)):null};
 })});return result.success?result.data:null;
}
function csvCell(v:string){return `"${(/^[\s\uFEFF]*[=+\-@]/.test(v)?"'"+v:v).replaceAll('"','""')}"`;}
export function monthCloseChecklistCsv(input:MonthCloseChecklist,zh:boolean){
 const s=monthCloseChecklistSchema.parse(input),closure=monthClosure(input,{organizationId:input.organization_id,month:input.month}),t=(cn:string,en:string)=>zh?cn:en;
 const amount=(v:string|null)=>v===null?'':fundsAmount(v),time=(v:string|null)=>v===null?'':statementPublishedAt(v,zh);
 const rows=[
 [t('内部月结办理清单','Internal month-close checklist')],
 [t('用途','Purpose'),t('内部财务留档与交接，不是客户账单、税务发票或结清证明；下载不批准、扣款、汇款或锁定数据。','Internal finance handoff, not a client bill, tax invoice or settlement certificate. Downloading does not approve, charge, remit or lock data.')],
 [t('企业','Company'),s.organization_name],[t('企业编号','Company ID'),s.organization_id],[t('结算月份','Settlement month'),s.month.slice(0,7)],[t('清单生成时间','Checklist generated at'),time(s.generated_at)],
 [t('读取口径','Read basis'),t('各模块读取页面查询结果，可能因并发更新而变化；以原账单、流水和复核记录为准。','Based on page query results from separate modules, subject to concurrent updates. Original statements, ledger entries and reviews are authoritative.')],
 [t('本月系统记录闭环状态','Monthly system-record completion'),closureLabel(closure.state,zh)],
 [t('资金账户','CNY wallet'),s.wallet_id||t('尚未开户','Not opened')],[t('查询时点已入账余额 CNY','Posted balance at query time CNY'),amount(s.balance_minor)],
 [t('待复核到账笔数（查询时点）','Pending receipts at query time'),String(s.pending_receipt_count)],[t('待复核到账金额 CNY（不计入余额）','Pending receipt amount CNY (excluded from balance)'),amount(s.pending_receipt_minor)],
 [t('资金口径说明','Funds basis'),t('以上不是月末余额，也未为草稿预留资金；广告结算月份可能与资金入账月份不同。CNY与CAD分列，不相加。','These are not month-end balances or reserved draft funds. Settlement and posting months may differ. CNY and CAD are separate and must not be added.')],
 [t('已复核待发布草稿数量','Reviewed unpublished drafts'),String(s.funding.approved_count)],[t('已复核待发布草稿合计 CNY','Reviewed unpublished drafts CNY'),fundsAmount(s.funding.approved_minor)],[t('覆盖这些草稿尚差 CNY','Shortfall for these drafts CNY'),amount(s.funding.shortfall_minor)],[t('未纳入合计的其他未发布账户','Other unpublished accounts excluded'),String(s.funding.excluded_count)],[t('资金合计核算说明','Combined funding basis'),fundingDescription(s.funding,zh)],[t('核算范围','Assessment scope'),t('只核算本月当前已复核且具备来源条件的待发布草稿；排除已发布、未复核、退回、归档和尚未制单的费用。其他月份也共用此余额，不预留资金，发布仍重新锁定核验。','Only current reviewed drafts with usable sources in this month are assessed. Posted, unreviewed, rejected, archived and unprepared charges are excluded. Other months share the wallet; funds are not reserved and publication locks/rechecks again.')],
 [t('账单关联工单总数','Statement-linked questions'),String(s.questions.total_count)],[t('新建问题','Open questions'),String(s.questions.open_count)],[t('处理中问题','Questions in progress'),String(s.questions.in_progress_count)],[t('团队已处理问题','Team-marked resolved questions'),String(s.questions.resolved_count)],
 [t('查阅与工单说明','Acknowledgement and request basis'),t('客户查阅不代表同意收费；工单已处理不代表客户认可，客户追问可重开。一般未关联账单的服务工单不计入。','Reading does not establish fee agreement; team resolution does not mean client acceptance and a follow-up can reopen a request. Unlinked general service requests are excluded.')],[],
 [t('账户逐项办理状态','Per-account workflow status')],
 (zh?['广告账户','账户编号','归属关联编号','广告账户时区','当前办理状态','来源编号','来源核实依据已具备','草稿编号','草稿金额 CNY（未发布不扣款）','正式账单编号','已发布账单已扣金额 CNY','发布时间（温哥华）','客户查阅确认次数','最近查阅确认（温哥华）','采购额 CAD','已复核核销 CAD','待复核分配 CAD','是否有撤销待复核']:['Advertiser','Account ID','Binding ID','Account timezone','Workflow status','Source ID','Source basis ready','Draft ID','Draft CNY (unposted drafts not charged)','Published statement ID','Posted statement charge CNY','Published (Vancouver)','Client reading acknowledgement count','Latest reading acknowledgement (Vancouver)','Procurement CAD','Verified allocation CAD','Pending allocation CAD','Reversal awaiting review']),
 ...s.accounts.map(a=>[a.account_label,a.account_id,a.binding_id,a.timezone||t('待确认','Unconfirmed'),closeStages[a.stage][zh?'zh':'en'],a.source_id||'',a.source_ready?t('是','Yes'):t('否','No'),a.draft_id||'',amount(a.draft_total_cny_minor),a.statement_id||'',amount(a.posted_total_cny_minor),time(a.published_at),a.confirmation_count===null?'':String(a.confirmation_count),time(a.last_confirmed_at),amount(a.procurement_cad_minor),amount(a.verified_cad_minor),amount(a.pending_cad_minor),a.reversal_pending===null?'':a.reversal_pending?t('是','Yes'):t('否','No')]),
 [],[t('空白与核销说明','Blank fields and allocation basis'),t('未发布账户的账单、查阅及核销字段留空，不推断零费用或结清。公司间核销来自系统记录，不代替银行原件，亦不再次扣客户余额。清单不会自动更新。','Statement, reading and allocation fields remain blank for unpublished accounts; do not infer zero costs or settlement. System allocations do not replace bank originals or debit clients again. This file does not update automatically.')],
 ];return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

export type ClosureState={state:'complete'|'pending'|'followup'|'unknown';accounts:number;published:number;acknowledged:number;allocated:number;unresolved:number|null};
// A read-time assessment, not an irreversible close or accounting certificate.
// Only server-projected, complete and scoped evidence can establish completion.
export function monthClosure(input:unknown,scope:{organizationId:string;month:string}):ClosureState{
 const unknown:ClosureState={state:'unknown',accounts:0,published:0,acknowledged:0,allocated:0,unresolved:null};
 const parsed=monthCloseChecklistSchema.safeParse(input);if(!parsed.success)return unknown;const s=parsed.data;
 if(s.organization_id!==scope.organizationId||s.month!==scope.month||new Set(s.accounts.map(a=>a.binding_id)).size!==s.accounts.length||s.questions.total_count!==s.questions.open_count+s.questions.in_progress_count+s.questions.resolved_count)return unknown;
 const posted=s.accounts.filter(a=>a.stage==='published');
 if(s.accounts.some(a=>a.stage!=='published'&&(a.statement_id!==null||a.posted_total_cny_minor!==null||a.published_at!==null)))return unknown;
 if(new Set(posted.map(a=>a.statement_id)).size!==posted.length||posted.some(a=>!a.statement_id||!a.source_id||!a.draft_id||!a.published_at||a.posted_total_cny_minor===null||a.posted_total_cny_minor!==a.draft_total_cny_minor||a.confirmation_count===null||a.procurement_cad_minor===null||a.verified_cad_minor===null||a.pending_cad_minor===null||a.reversal_pending===null||(a.confirmation_count===0)!==(a.last_confirmed_at===null)||BigInt(a.verified_cad_minor)>BigInt(a.procurement_cad_minor)))return unknown;
 const acknowledged=posted.filter(a=>a.confirmation_count!>0).length;
 const allocated=posted.filter(a=>a.procurement_cad_minor===a.verified_cad_minor&&a.pending_cad_minor==='0'&&!a.reversal_pending).length;
 const ready=!!s.wallet_id&&posted.length===s.accounts.length&&acknowledged===posted.length&&allocated===posted.length;
 const unresolved=s.questions.open_count+s.questions.in_progress_count;
 return {state:!ready?'pending':unresolved?'followup':'complete',accounts:s.accounts.length,published:posted.length,acknowledged,allocated,unresolved};
}
export function closureLabel(state:ClosureState['state'],zh:boolean){return ({complete:zh?'本月系统记录已闭环':'Monthly system records complete',pending:zh?'本月仍有业务待办':'Monthly business tasks remain',followup:zh?'主流程已贯通，账单问题仍待跟进':'Main workflow complete; billing follow-up remains',unknown:zh?'闭环状态待核实':'Completion status unconfirmed'})[state];}
