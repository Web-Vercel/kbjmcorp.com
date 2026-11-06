import {z} from 'zod';
import {toMinor} from '@/lib/billing/model';
const text=(max:number)=>z.string().trim().min(3).max(max);
const amount=z.string().refine(v=>{try{return BigInt(toMinor(v))>0n;}catch{return false;}},'Invalid amount');
export const collectionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('account'),legalName:text(180),bankName:text(180),accountNumber:z.string().trim().regex(/^[0-9A-Za-z -]{6,50}$/),evidence:text(180),confirm:z.literal('on')}),
 z.object({action:z.literal('assign'),walletId:z.uuid(),accountId:z.uuid(),agreement:text(180),confirm:z.literal('on')}),
 z.object({action:z.literal('active'),accountId:z.uuid(),active:z.enum(['yes','no']),confirm:z.literal('on')}),
 z.object({action:z.literal('receipt'),walletId:z.uuid(),topupId:z.union([z.uuid(),z.literal('')]).default(''),amount,payerName:text(180),bankReference:text(120),bookedDate:z.iso.date(),evidence:text(180),confirm:z.literal('on')}),
 z.object({action:z.literal('review'),receiptId:z.uuid(),decision:z.enum(['credited','rejected']),note:text(1000),confirm:z.literal('on')})
]);
// Phase 2 candidate matching only. A suggestion never posts a receipt or calls a bank.
export type MatchRequest={id:string;walletId:string;collectionAccountId:string;currency:string;amountMinor:string;reference:string;status:string};
export type BankStatementRow={id:string;collectionAccountId:string;currency:string;amountMinor:string;reference:string};
export function suggestBankMatch(row:BankStatementRow,requests:MatchRequest[]){
 if(!/^\d+$/.test(row.amountMinor)||BigInt(row.amountMinor)<=0n||!row.reference.trim())return {status:'invalid' as const,candidates:[] as string[]};
 const candidates=requests.filter(r=>r.status==='pending'&&r.collectionAccountId===row.collectionAccountId&&r.currency===row.currency&&r.amountMinor===row.amountMinor&&r.reference.trim()===row.reference.trim()).map(r=>r.id);
 return {status:candidates.length===1?'suggested' as const:candidates.length?'ambiguous' as const:'unmatched' as const,candidates};
}
