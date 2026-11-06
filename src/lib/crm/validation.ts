import { z } from "zod";
const optionalId=z.union([z.uuid(),z.literal("")]).default("");
const phone=z.string().trim().max(16).refine(v=>!v||(/^\+[1-9]\d{6,14}$/.test(v)&&(!v.startsWith('+86')||/^\+861[3-9]\d{9}$/.test(v))));
const url=z.union([z.literal(""),z.url().max(500).refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!v.includes('@');})]).default("");
export const crmActionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal('client'),organizationId:optionalId,name:z.string().trim().min(2).max(160),legalName:z.string().trim().min(2).max(160),registration:z.string().trim().max(80).default(''),country:z.string().regex(/^[A-Z]{2}$/),website:url,industry:z.string().trim().max(100).default(''),status:z.enum(['prospect','onboarding','active','paused','closed']),notes:z.string().trim().max(2000).default(''),revision:z.coerce.number().int().min(0).default(0)}),
 z.object({action:z.literal('contact'),organizationId:z.uuid(),contactId:optionalId,name:z.string().trim().min(1).max(100),title:z.string().trim().max(100).default(''),phone,email:z.union([z.literal(''),z.email().max(254)]).default(''),kind:z.enum(['business','finance','legal'])}).refine(v=>v.phone||v.email),
 z.object({action:z.literal('invite'),organizationId:z.uuid(),contactId:z.uuid(),businessRole:z.enum(['viewer','admin']),financeRole:z.enum(['none','viewer','manager']),evidence:z.string().trim().min(3).max(160),confirm:z.literal('on')}),
 z.object({action:z.literal('revoke'),organizationId:z.uuid(),userId:optionalId,inviteId:optionalId,confirm:z.literal('on')}).refine(v=>v.userId||v.inviteId),
 z.object({action:z.literal('finance'),organizationId:z.uuid(),userId:z.uuid(),role:z.enum(['none','viewer','manager']),confirm:z.literal('on')}),
 z.object({action:z.literal('wallet'),organizationId:z.uuid(),confirm:z.literal('on')}),
 z.object({action:z.literal('contract'),organizationId:z.uuid(),title:z.string().trim().min(2).max(160),provider:z.string().trim().min(2).max(160),scope:z.string().trim().min(10).max(1500),pricing:z.string().trim().min(10).max(1500),refund:z.string().trim().min(10).max(1000),starts:z.iso.date(),ends:z.iso.date()}).refine(v=>v.ends>=v.starts),
 z.object({action:z.literal('contractStatus'),contractId:z.uuid(),status:z.enum(['draft','sent','signed','expired','terminated']),expectedStatus:z.enum(['draft','sent','signed','expired','terminated']),clientVisible:z.enum(['yes','no']),signatureReference:z.string().trim().max(180).default(''),signedOn:z.union([z.literal(''),z.iso.date()]).default(''),confirm:z.literal('on')}),
]);
