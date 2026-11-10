import {z} from 'zod';
import {closeStages,type CloseOverview} from './month-close';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/);
const signed=z.string().regex(/^-?(0|[1-9]\d{0,29})$/);
const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const account=z.object({
 binding_id:z.uuid(),account_id:z.string().min(1).max(160),account_label:z.string().max(1000),active:z.boolean(),timezone:z.string().min(1).max(100).nullable(),
 stage:z.enum(Object.keys(closeStages) as [keyof typeof closeStages,...(keyof typeof closeStages)[]]),
 source_id:z.uuid().nullable(),source_ready:z.boolean(),coverage_reason:z.string().max(1000).nullable(),coverage_kind:z.string().max(100).nullable(),source_cad_minor:minor.nullable(),
 operational_source_count:count,quote_match_count:count,coverage_prepared_by_me:z.boolean(),draft_id:z.uuid().nullable(),draft_status:z.enum(['approved','rejected']).nullable().optional(),draft_prepared_by_me:z.boolean(),draft_total_cny_minor:minor.nullable(),newer_shared_source:z.boolean(),
 statement_id:z.uuid().nullable(),published_at:z.iso.datetime({offset:true}).nullable(),posted_total_cny_minor:minor.nullable(),
});
const schema=z.object({organization_id:z.uuid(),month:z.iso.date().refine(v=>v.endsWith('-01')),accounts:account.array().max(1000),wallet_id:z.uuid().nullable(),balance_minor:signed,pending_receipt_count:count,pending_receipt_minor:minor}).superRefine((data,ctx)=>{
 const fail=()=>ctx.addIssue({code:'custom',message:'Inconsistent monthly overview'});
 for(const key of ['binding_id','account_id','draft_id','statement_id'] as const){const ids=data.accounts.map(a=>a[key]).filter(v=>v!==null);if(new Set(ids).size!==ids.length)fail();}
 for(const a of data.accounts){
  const published=a.stage==='published';
  if(published!==(a.statement_id!==null)||published!==(a.published_at!==null)||published!==(a.posted_total_cny_minor!==null))fail();
  if((a.draft_id===null)!==(a.draft_total_cny_minor===null))fail();
  if(published&&(!a.draft_id||a.draft_total_cny_minor!==a.posted_total_cny_minor))fail();
  if(a.source_ready&&!a.source_id)fail();
 }
});
// Use the same validated scope for rendering, role-specific actions and dependent reads.
export function monthCloseOverview(input:unknown,scope:{organizationId:string;month:string}):CloseOverview|null{
 const parsed=schema.safeParse(input);if(!parsed.success)return null;const data=parsed.data;
 return data.organization_id===scope.organizationId&&data.month===scope.month?data:null;
}
