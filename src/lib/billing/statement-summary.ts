import {z} from 'zod';
const minor=z.string().regex(/^\d{1,30}$/);
export const statementSummarySchema=z.object({wallet_id:z.uuid(),month:z.iso.date(),statement_count:z.number().int().positive(),advertising_service_minor:minor,operating_other_minor:minor,total_minor:minor}).refine(s=>BigInt(s.advertising_service_minor)+BigInt(s.operating_other_minor)===BigInt(s.total_minor));
export type StatementSummary=z.infer<typeof statementSummarySchema>;
export function linkedStatementId(reference:unknown,kind:string,amount:string):string|undefined{
 if(typeof reference!=='string'||!['ad_spend','service_fee'].includes(kind)||!/^-[0-9]+$/.test(amount))return;
 const candidate=reference.startsWith('monthly-statement:')?reference.slice('monthly-statement:'.length):'';
 return z.uuid().safeParse(candidate).success?candidate:undefined;
}
