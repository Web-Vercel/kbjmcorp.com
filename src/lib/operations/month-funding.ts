import {z} from 'zod';
import {closeStages} from './month-close';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/),signed=z.string().regex(/^-?(0|[1-9]\d{0,29})$/);
const month=z.iso.date().refine(v=>v.endsWith('-01'));
const stages=z.enum(Object.keys(closeStages) as [keyof typeof closeStages,...(keyof typeof closeStages)[]]);
const inputSchema=z.object({organization_id:z.uuid(),month,wallet_id:z.uuid().nullable(),balance_minor:signed,accounts:z.array(z.object({binding_id:z.uuid(),stage:stages,source_ready:z.boolean(),draft_id:z.uuid().nullable(),draft_status:z.enum(['approved','rejected']).nullable().optional(),draft_total_cny_minor:minor.nullable(),statement_id:z.uuid().nullable()})).max(1000)});
export const monthFundingSchema=z.object({organization_id:z.uuid(),month,wallet_id:z.uuid().nullable(),account_count:z.number().int().nonnegative(),approved_count:z.number().int().nonnegative(),approved_minor:minor,excluded_count:z.number().int().nonnegative(),published_count:z.number().int().nonnegative(),shortfall_minor:minor.nullable(),remaining_minor:signed.nullable(),state:z.enum(['no_candidates','not_opened','shortfall','covered'])});
export type MonthFunding=z.infer<typeof monthFundingSchema>;
const candidateStages=new Set(['publication_ready','funding_needed','wallet_needed']);
export function monthFunding(input:unknown,scope?:{organizationId:string;month:string}):MonthFunding|null{
 const parsed=inputSchema.safeParse(input);if(!parsed.success)return null;const d=parsed.data;
 if(scope&&(d.organization_id!==scope.organizationId||d.month!==scope.month))return null;
 if(new Set(d.accounts.map(a=>a.binding_id)).size!==d.accounts.length)return null;
 if(d.accounts.some(a=>(a.stage==='published')!==(a.statement_id!==null)||(a.draft_id===null)!==(a.draft_total_cny_minor===null)))return null;
 const published=d.accounts.filter(a=>a.stage==='published');if(new Set(published.map(a=>a.statement_id)).size!==published.length)return null;
 const candidates=d.accounts.filter(a=>candidateStages.has(a.stage));
 if(candidates.some(a=>!a.draft_id||a.draft_status!=='approved'||a.draft_total_cny_minor===null||!a.source_ready)||new Set(candidates.map(a=>a.draft_id)).size!==candidates.length)return null;
 const total=candidates.reduce((sum,a)=>sum+BigInt(a.draft_total_cny_minor!),0n),remaining=d.wallet_id&&candidates.length?BigInt(d.balance_minor)-total:null;
 const result={organization_id:d.organization_id,month:d.month,wallet_id:d.wallet_id,account_count:d.accounts.length,approved_count:candidates.length,approved_minor:total.toString(),published_count:published.length,excluded_count:d.accounts.length-candidates.length-published.length,
 shortfall_minor:remaining===null?null:(remaining<0n?-remaining:0n).toString(),remaining_minor:remaining?.toString()??null,state:!candidates.length?'no_candidates':!d.wallet_id?'not_opened':remaining!==null&&remaining<0n?'shortfall':'covered'};
 const valid=monthFundingSchema.safeParse(result);return valid.success?valid.data:null;
}
export function fundingDescription(plan:MonthFunding|null,zh:boolean){
 if(!plan)return zh?'待发布草稿资金核算暂不可用，不能据此认定资金充足。':'Draft funding assessment unavailable; sufficient funds cannot be inferred.';
 const money=(s:string)=>{const n=BigInt(s);return `${n/100n}.${String(n%100n).padStart(2,'0')}`;};
 if(plan.state==='no_candidates')return zh?'当前没有已复核、具备发布条件的待发布草稿；其他费用仍需明确后核对，不据此认定本月没有费用。':'No independently reviewed drafts currently qualify for publication. Verify other charges when known; this does not establish zero monthly costs.';
 if(plan.state==='not_opened')return zh?'已复核待发布草稿已汇总，但尚未开立人民币资金账户，暂不能判断可用资金。':'Reviewed drafts are totaled, but no CNY wallet is open; available funds cannot yet be assessed.';
 return plan.state==='shortfall'?(zh?`当前余额覆盖本月这些已复核待发布草稿，尚差 CNY ${money(plan.shortfall_minor!)}；待核对到账未计入。`:`Current funds fall short by CNY ${money(plan.shortfall_minor!)} for these reviewed drafts. Pending receipts are excluded.`):(zh?`查询时点余额可覆盖本月这些已复核待发布草稿；未为草稿预留，正式发布仍需重新校验。${plan.excluded_count?'另有未发布账户未纳入，不代表整月费用已全部覆盖。':''}`:`Query-time funds cover these reviewed drafts. Funds are not reserved and publication checks the balance again.${plan.excluded_count?' Other unpublished accounts are excluded; this does not establish coverage for every monthly charge.':''}`);
}
