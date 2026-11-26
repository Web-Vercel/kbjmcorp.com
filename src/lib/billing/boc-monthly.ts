import {z} from 'zod';
import {parseBocReference} from './boc-reference';

/** Closed billing months only. BoC dates follow its Toronto publication calendar. */
export function bocMonthWindow(month:string,now=new Date()) {
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid billing month');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit'}).formatToParts(now);
 const current=parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value;
 if(month>=current)throw new Error('Billing month is not closed');
 const [year,m]=month.split('-').map(Number);
 const end=new Date(Date.UTC(year,m,0)).toISOString().slice(0,10);
 return {start:month+'-01',end};
}
export function bocMonthlyUrl(month:string,now=new Date()) {
 const range=bocMonthWindow(month,now);
 return `https://www.bankofcanada.ca/valet/observations/FXCNYCAD/json?start_date=${range.start}&end_date=${range.end}`;
}
export function parseBocMonthlyReference(input:unknown,month:string,now=new Date()) {
 const range=bocMonthWindow(month,now);
 const parsed=z.object({observations:z.array(z.object({d:z.iso.date(),FXCNYCAD:z.object({v:z.string()}).optional()})).max(31)}).parse(input);
 const seen=new Set<string>();
 for(const row of parsed.observations){if(row.d<range.start||row.d>range.end||seen.has(row.d))throw new Error('Invalid observation dates');seen.add(row.d);}
 const rows=parsed.observations.filter(row=>row.FXCNYCAD).sort((a,b)=>b.d.localeCompare(a.d));
 const latest=rows[0];if(!latest)throw new Error('Missing monthly reference');
 // Fail closed on implausibly stale data; no substitution of an estimated rate.
 const reference=parseBocReference({observations:[latest]},new Date(range.end+'T23:59:59Z'));
 return {...reference,fetchedAt:now.toISOString(),billingMonth:month,policy:'month_end_last_published' as const,sourceUrl:bocMonthlyUrl(month,now)};
}
