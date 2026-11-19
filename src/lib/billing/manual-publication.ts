import {z} from 'zod';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/);
export const manualPublicationInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('preview'),draftId:z.uuid()}),
 z.object({action:z.literal('publish'),draftId:z.uuid(),summary:z.string().trim().min(3).max(2000),confirm:z.literal('on')})
]);
export const manualPublicationPreview=z.object({draftId:z.uuid(),organizationId:z.uuid(),period:z.iso.date(),status:z.string(),testRecord:z.boolean(),amountMinor:minor,walletOpen:z.boolean(),balanceMinor:z.string().regex(/^-?\d+$/),heldMinor:minor,availableMinor:minor,statementId:z.uuid().nullable()});
export type ManualPublicationPreview=z.infer<typeof manualPublicationPreview>;
