import {z} from 'zod';
export const publicationInput=z.object({draftId:z.uuid(),summary:z.string().trim().min(3).max(2000),confirm:z.literal('on')});
export const publicationSuccess=z.object({ok:z.literal(true),id:z.uuid()});
