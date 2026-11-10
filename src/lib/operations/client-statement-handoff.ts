import {z} from 'zod';
import {statementReadStatus} from '@/lib/billing/statement-read';
export function clientStatementPath(statementId:string,locale:'zh'|'en'){
 if(!z.uuid().safeParse(statementId).success)return null;
 return `/${locale}/account/statements?${new URLSearchParams({statement:statementId})}#statement-${statementId}`;
}
export function statementAcknowledgement(input:unknown,statementId:string):{state:'acknowledged'|'pending'|'unknown';count:number|null;at:string|null}{
 const unknown={state:'unknown' as const,count:null,at:null};const parsed=statementReadStatus.safeParse(input);
 if(!parsed.success||parsed.data.statement_count!==parsed.data.statements.length)return unknown;
 const rows=parsed.data.statements;if(new Set(rows.map(r=>r.statement_id)).size!==rows.length)return unknown;
 if(rows.some(r=>(r.confirmation_count===0)!==(r.last_confirmed_at===null)))return unknown;
 const row=rows.find(r=>r.statement_id===statementId);if(!row)return unknown;
 return {state:row.confirmation_count>0?'acknowledged':'pending',count:row.confirmation_count,at:row.last_confirmed_at};
}
