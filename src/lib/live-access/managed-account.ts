import {z} from 'zod';
export const managedAccount=z.object({userId:z.uuid(),email:z.email(),label:z.string(),role:z.enum(['admin','operator','client','agent','investor','sales']),company:z.string().nullable(),active:z.boolean(),self:z.boolean(),duties:z.array(z.string()),locked:z.boolean(),operationId:z.uuid().nullable()});
export type ManagedAccount=z.infer<typeof managedAccount>;
const base={requestId:z.uuid(),userId:z.uuid(),expectedEmail:z.email().max(254),reason:z.string().trim().min(3).max(1000),confirm:z.literal('on')};
export const credentialInput=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('password'),password:z.string().min(16).max(128)}),
 z.object({...base,action:z.literal('email'),email:z.email().max(254),emailVerified:z.literal('on')}),
 z.object({action:z.literal('reconcile'),operationId:z.uuid(),userId:z.uuid(),confirm:z.literal('on')}),
]);
