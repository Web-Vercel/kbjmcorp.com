import {z} from 'zod';
export const serviceReplyReceipt=z.object({message_id:z.uuid(),request_id:z.uuid(),status:z.enum(['open','in_progress','resolved']),created_at:z.iso.datetime({offset:true}),replayed:z.boolean()});
export type ServiceReplyReceipt=z.infer<typeof serviceReplyReceipt>;
