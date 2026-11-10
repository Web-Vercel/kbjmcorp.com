import {z} from 'zod';
export const statementReadReceipt=z.object({statement_id:z.uuid(),confirmed_at:z.iso.datetime({offset:true})});
export const statementReadStatus=z.object({statement_count:z.number().int().nonnegative(),statements:z.array(z.object({statement_id:z.uuid(),confirmation_count:z.number().int().nonnegative(),last_confirmed_at:z.iso.datetime({offset:true}).nullable()})).max(200)});
export type StatementReadStatus=z.infer<typeof statementReadStatus>;
