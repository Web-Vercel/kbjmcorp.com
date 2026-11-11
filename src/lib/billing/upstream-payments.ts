import {z} from 'zod';
const money=z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).refine(v=>Number(v)>0);
const note=z.string().trim().min(3).max(1000);
export const upstreamPaymentInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('submit'),requestId:z.uuid(),organizationId:z.uuid(),bankReference:z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/),receivedOn:z.iso.date(),received:money,evidence:note,hash:z.string().regex(/^[a-f0-9]{64}$/),note,allocations:z.array(z.object({statementId:z.uuid(),amount:money})).min(1).max(20),confirm:z.literal('on')}),
 z.object({action:z.literal('reversal_submit'),paymentId:z.uuid(),requestId:z.uuid(),reason:note,evidence:note,hash:z.string().regex(/^[a-f0-9]{64}$/),confirm:z.literal('on')}),
 z.object({action:z.literal('reversal_review'),reversalId:z.uuid(),decision:z.enum(['approved','rejected']),note,confirm:z.literal('on')}),
 z.object({action:z.literal('review'),paymentId:z.uuid(),decision:z.enum(['approved','rejected']),note,confirm:z.literal('on')})
]);
const minor=z.string().regex(/^\d{1,20}$/);
const reversal=z.object({id:z.uuid(),revision:z.number().int().positive(),reason:z.string(),evidence_reference:z.string(),evidence_sha256:z.string(),prepared_by:z.uuid(),prepared_at:z.iso.datetime({offset:true}),status:z.enum(['pending','approved','rejected']),review_note:z.string().nullable(),reviewed_at:z.iso.datetime({offset:true}).nullable()});
export const upstreamPaymentWorkbench=z.object({reversal_enabled:z.boolean().default(false),statement_count:z.number().int().nonnegative(),payment_count:z.number().int().nonnegative(),statements:z.array(z.object({id:z.uuid(),account_name:z.string(),month:z.iso.date(),procurement_cad_minor:minor,verified_cad_minor:minor,pending_cad_minor:minor})).max(200),payments:z.array(z.object({id:z.uuid(),reversed:z.boolean().default(false),reversal_pending:z.boolean().default(false),reversal_count:z.number().int().nonnegative().default(0),reversals:z.array(reversal).max(10).default([]),revision:z.number().int().positive(),bank_reference:z.string(),received_on:z.iso.date(),received_cad_minor:minor,evidence_reference:z.string(),evidence_sha256:z.string(),note:z.string(),prepared_by:z.uuid(),prepared_at:z.iso.datetime({offset:true}),status:z.enum(['pending','approved','rejected']),review_note:z.string().nullable(),reviewed_at:z.iso.datetime({offset:true}).nullable(),allocations:z.array(z.object({statement_id:z.uuid(),amount_cad_minor:minor,month:z.iso.date(),account_name:z.string()})).max(20)})).max(100)});
export type PaymentStatement=z.infer<typeof upstreamPaymentWorkbench>['statements'][number];

export type PaymentRecord=z.infer<typeof upstreamPaymentWorkbench>['payments'][number];

// Operation receipts confirm the original action, not the current bank or allocation state.
export const upstreamActionReceipt=z.object({id:z.uuid(),action:z.enum(['submit','review','reversal_submit','reversal_review']),stage:z.enum(['registered','approved','rejected']),organizationId:z.uuid().optional(),paymentId:z.uuid().optional()});
export type UpstreamActionReceipt=z.infer<typeof upstreamActionReceipt>;
