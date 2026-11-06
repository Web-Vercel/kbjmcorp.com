import {describe,expect,it} from 'vitest';
import {collectionSchema,suggestBankMatch,type MatchRequest} from '@/lib/collections/model';
const row={id:'row',collectionAccountId:'bank',currency:'CNY',amountMinor:'1000000',reference:'REF-001'};
const request:MatchRequest={id:'notice',walletId:'wallet',collectionAccountId:'bank',currency:'CNY',amountMinor:'1000000',reference:'REF-001',status:'pending'};
describe('Conservative bank matching',()=>{
 it('suggests a unique exact match only',()=>expect(suggestBankMatch(row,[request])).toEqual({status:'suggested',candidates:['notice']}));
 it('flags ambiguity without choosing a customer',()=>expect(suggestBankMatch(row,[request,{...request,id:'other',walletId:'other-company'}]).status).toBe('ambiguous'));
 it.each([{currency:'CAD'},{collectionAccountId:'other-bank'},{amountMinor:'999999'},{reference:'REF-002'},{status:'credited'}])('requires matching account, currency, exact amount, reference and pending status %j',patch=>expect(suggestBankMatch(row,[{...request,...patch}]).status).toBe('unmatched'));
 it('rejects invalid and negative bank amounts',()=>{expect(suggestBankMatch({...row,amountMinor:'-100'},[request]).status).toBe('invalid');expect(suggestBankMatch({...row,reference:''},[request]).status).toBe('invalid');});
 it('requires explicit actual-bank confirmation and valid money/date formats',()=>{
 const data={action:'receipt',walletId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',amount:'10000.01',payerName:'Test company',bankReference:'REF001',bookedDate:'2026-11-06',evidence:'Test statement',confirm:'on'};
 expect(collectionSchema.safeParse(data).success).toBe(true);
 for(const patch of [{confirm:''},{amount:'-1'},{amount:'1.001'},{bookedDate:'2026-02-30'},{amount:'0'}])expect(collectionSchema.safeParse({...data,...patch}).success).toBe(false);
 });
});
