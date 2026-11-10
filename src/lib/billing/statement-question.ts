import {z} from 'zod';
export const statementQuestionInput=z.object({statementId:z.uuid(),requestId:z.uuid(),subject:z.string().trim().min(3).max(160),body:z.string().trim().min(3).max(1500)});
