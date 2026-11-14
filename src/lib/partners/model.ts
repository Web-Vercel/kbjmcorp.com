import {z} from 'zod';
const id=z.uuid(),note=z.string().trim().min(3).max(1000),minor=z.string().regex(/^-?[0-9]{1,10}$/),day=z.iso.date();
const shape={requestId:id,note};
export const partnerCommand=z.discriminatedUnion('action',[
 z.object({...shape,action:z.literal('agent_save'),userId:id,email:z.email().max(254),label:z.string().trim().min(3).max(80),revision:z.coerce.number().int().min(0),active:z.boolean()}),
 z.object({...shape,action:z.literal('lead_submit'),company:z.string().trim().min(2).max(180)}),
 z.object({...shape,action:z.literal('lead_review'),id,decision:z.enum(['confirmed','rejected']),organizationId:id.optional()}),
 z.object({...shape,action:z.literal('assignment_save'),agentId:id,organizationId:id,from:day,until:z.union([day,z.literal('')]),rateBps:z.coerce.number().int().min(0).max(10000),basis:z.enum(['service','total']),waitDays:z.coerce.number().int().min(0).max(365)}),
 z.object({...shape,action:z.literal('assignment_end'),id,until:day}),
 z.object({...shape,action:z.literal('refund_policy'),walletId:id,mode:z.enum(['fixed','percent']),value:z.coerce.number().int().min(0).max(99999999)}),
 z.object({...shape,action:z.literal('refund_request'),walletId:id,policyId:id,amountMinor:minor,accepted:z.literal(true)}),
 ...(['refund_cancel','refund_prepare','refund_approve','refund_reject','refund_withdraw','settlement_approve','settlement_cancel'] as const).map(action=>z.object({...shape,action:z.literal(action),id})),
 ...(['refund_review','commission_review','settlement_review','payment_verify'] as const).map(action=>z.object({...shape,action:z.literal(action),id,decision:z.enum(['approve','reject'])})),
 z.object({...shape,action:z.literal('commission_prepare'),statementId:id}),
 z.object({...shape,action:z.literal('commission_adjust'),id,amountMinor:minor}),
 z.object({...shape,action:z.literal('settlement_prepare'),agentId:id,period:day}),
 z.object({...shape,action:z.literal('payment_record'),id,kind:z.enum(['refund','commission']),amountMinor:minor,bankReference:z.string().trim().min(3).max(160),payeeReference:z.string().trim().min(3).max(300),paidOn:day}),
]);
export const actionReceipt=z.object({id,action:z.string()});
const money=z.string().regex(/^-?\d{1,30}$/),nullableText=z.string().nullable(),timestamp=z.string();
export const policySchema=z.object({id,mode:z.enum(['fixed','percent']),value:z.number().int().nonnegative(),agreement:z.string()});
export const paymentSchema=z.object({id,kind:z.enum(['refund','commission']),target_id:id,amount_minor:money,paid_on:day,status:z.enum(['pending','verified','rejected']),prepared_by_me:z.boolean(),bank_reference:nullableText,payee_reference:nullableText,evidence:nullableText});
export const refundWorkspace=z.object({staff:z.boolean(),owner:z.boolean(),wallets:z.array(z.object({id,organization_id:id,name:z.string(),currency:z.literal('CNY'),can_request:z.boolean(),balance_minor:money,held_minor:money,available_minor:money,policy:policySchema.nullable()})),refunds:z.array(z.object({id,wallet_id:id,organization_id:id,company:z.string(),gross_minor:money,fee_minor:money,net_minor:money,policy_snapshot:z.object({mode:z.enum(['fixed','percent']),value:z.number(),agreement:z.string()}),reason:z.string(),status:z.enum(['requested','prepared','reviewed','approved','payment_pending','paid','rejected','cancelled']),review_note:nullableText,assessment:nullableText,prepared_by_me:z.boolean().nullable(),requested_by_me:z.boolean(),created_at:timestamp,paid_at:timestamp.nullable()})),payments:z.array(paymentSchema)});
export const partnerWorkspace=z.object({agentId:id.nullable(),label:nullableText,staff:z.boolean(),owner:z.boolean(),
 agents:z.array(z.object({id,user_id:id,label:z.string(),active:z.boolean(),revision:z.number(),email:nullableText,agreement:nullableText})),
 clients:z.array(z.object({id,agent_id:id,organization_id:id,name:z.string(),valid_from:day,valid_until:day.nullable(),rate_bps:z.number(),basis:z.enum(['service','total']),wait_days:z.number()})),
 leads:z.array(z.object({id,agent_id:id,company:z.string(),note:z.string(),status:z.enum(['pending','confirmed','rejected']),review_note:nullableText,created_at:timestamp})),
 commissions:z.array(z.object({id,agent_id:id,organization_id:id,company:z.string(),statement_id:id,parent_id:id.nullable(),period:day,kind:z.enum(['earned','adjustment']),base_minor:money,rate_bps:z.number(),amount_minor:money,basis:z.enum(['service','total']),available_on:day,status:z.enum(['pending','approved','rejected']),settlement_id:id.nullable(),prepared_by_me:z.boolean(),refund_hold:z.boolean(),evidence:nullableText,review_note:nullableText})),
 settlements:z.array(z.object({id,agent_id:id,period:day,total_minor:money,status:z.enum(['prepared','reviewed','approved','payment_pending','paid','rejected']),paid_at:timestamp.nullable(),prepared_by_me:z.boolean(),review_note:nullableText,items:z.array(z.object({commissionId:id,amountMinor:money}))})),
 payments:z.array(paymentSchema),files:z.array(z.object({id,agent_id:id,lead_id:id.nullable(),assignment_id:id.nullable(),kind:z.enum(['agreement','referral']),name:z.string(),mime:z.string(),size_bytes:z.number(),sha256:z.string(),created_at:timestamp})),
 organizations:z.array(z.object({id,name:z.string()})),statements:z.array(z.object({id,organization_id:id,name:z.string(),month:day,total_cny_minor:money})),balances:z.array(z.object({agent_id:id,amount_minor:money}))
});
export type PartnerWorkspace=z.infer<typeof partnerWorkspace>;export type RefundWorkspace=z.infer<typeof refundWorkspace>;
export function feeFor(amount:bigint,policy:{mode:'fixed'|'percent';value:number}){return policy.mode==='fixed'?BigInt(policy.value):(amount*BigInt(policy.value)+5000n)/10000n;}
export function parseAmount(value:string){if(!/^\d{1,8}(\.\d{1,2})?$/.test(value))throw Error('invalid');const [a,b='']=value.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));}
export function displayAmount(value:string|bigint){const n=BigInt(value);return `${n<0n?'-':''}${(n<0n?-n:n)/100n}.${String((n<0n?-n:n)%100n).padStart(2,'0')}`;}
export const statusName:Record<string,string>={requested:'待核算',prepared:'待独立复核',reviewed:'已复核 · 待批准',approved:'已确认',payment_pending:'已登记付款 · 待核实',paid:'已核实付款',rejected:'已退回',cancelled:'已取消',pending:'待复核',verified:'付款已核实',confirmed:'已确认归属线索'};
