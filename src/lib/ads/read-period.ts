import {z} from 'zod';
import {addDays,calendarMonthRange,completedMonthRange,completedWeek,localDate} from './report-model';
export const readSelectionSchema=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('week')}),
 z.object({mode:z.literal('month'),month:z.iso.date().refine(v=>v.endsWith('-01'))}),
 z.object({mode:z.literal('month_to_date')}),
 z.object({mode:z.literal('custom'),since:z.iso.date(),until:z.iso.date()}),
]);
export type ReadSelection=z.infer<typeof readSelectionSchema>;
export function readPeriod(selection:ReadSelection,now:Date,timezone:string){
 const s=readSelectionSchema.parse(selection),today=localDate(now,timezone);
 if(s.mode==='week')return completedWeek(now,timezone);
 if(s.mode==='month')return completedMonthRange(s.month,now,timezone);
 const range=s.mode==='month_to_date'?{since:today.slice(0,7)+'-01',until:addDays(today,-1)}:{since:s.since,until:s.until};
 if(range.since>range.until||range.until>=today||range.since<addDays(today,-365)||range.until>addDays(range.since,30))throw new Error('Choose 1–31 completed days within retention');
 return range;
}
export function sameReadSelection(prior:{selection?:unknown;since:string;until:string},selection:ReadSelection){
 if(prior.selection){const parsed=readSelectionSchema.safeParse(prior.selection);return parsed.success&&JSON.stringify(parsed.data)===JSON.stringify(selection);}
 // Existing snapshots predate selection metadata. Only their original supported scopes qualify.
 if(selection.mode==='week')return prior.until===addDays(prior.since,6);
 if(selection.mode==='month'){const r=calendarMonthRange(selection.month);return r.since===prior.since&&r.until===prior.until;}
 return false;
}
