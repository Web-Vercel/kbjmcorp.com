import {z} from 'zod';
const month=z.iso.date().refine(v=>v.endsWith('-01'));
export const statementQuestionRow=z.object({id:z.uuid(),organization_id:z.uuid(),category:z.literal('billing'),subject:z.string().min(3).max(160),status:z.enum(['open','in_progress','resolved']),created_at:z.iso.datetime({offset:true}),updated_at:z.iso.datetime({offset:true}),statement_id:z.uuid(),statement_month:month});
export const statementQuestionWorkbench=z.object({organization_id:z.uuid(),month,total_count:z.number().int().nonnegative(),open_count:z.number().int().nonnegative(),in_progress_count:z.number().int().nonnegative(),resolved_count:z.number().int().nonnegative(),truncated:z.boolean(),rows:statementQuestionRow.array().max(100)}).superRefine((s,ctx)=>{
 const fail=()=>ctx.addIssue({code:'custom',message:'Question scope or counts mismatch'});
 if(s.total_count!==s.open_count+s.in_progress_count+s.resolved_count||s.truncated!==(s.total_count>100)||s.rows.length!==Math.min(100,s.total_count)||new Set(s.rows.map(r=>r.id)).size!==s.rows.length)fail();
 if(s.rows.some(r=>r.organization_id!==s.organization_id||r.statement_month!==s.month))fail();
 for(const [status,count] of [['open',s.open_count],['in_progress',s.in_progress_count],['resolved',s.resolved_count]] as const){const actual=s.rows.filter(r=>r.status===status).length;if(actual>count||!s.truncated&&actual!==count)fail();}
});
export type StatementQuestionWorkbench=z.infer<typeof statementQuestionWorkbench>;
export const statementQuestionColumns='id,organization_id,category,subject,status,created_at,updated_at,statement_id,statement_month';
export const statementQuestionMessage=z.object({id:z.uuid(),request_id:z.uuid(),body:z.string().max(1500),author_role:z.enum(['client','staff']),created_at:z.iso.datetime({offset:true})});
