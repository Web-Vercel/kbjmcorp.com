import {it,expect} from 'vitest';
import {lastEndedFundsMonth,monthlyFundsSchema,monthlyFundsCsv} from '@/lib/billing/monthly-funds';
const wallet='b0000000-0000-4000-8000-000000000001';
const report={wallet_id:wallet,organization_name:'=FICTIONAL()',currency:'CNY' as const,month:'2024-03-01',timezone:'America/Vancouver' as const,generated_at:'2024-04-02T00:00:00Z',opening_minor:'9007199254740993',credits_minor:'10000',debits_minor:'2500',closing_minor:'9007199254748493',entry_count:2,complete:true,entries:[{id:'b0000000-0000-4000-8000-000000000002',kind:'topup' as const,amount_minor:'10000',description:'=unsafe()',posted_at:'2024-03-01T08:00:00Z',statement_id:null},{id:'b0000000-0000-4000-8000-000000000003',kind:'service_fee' as const,amount_minor:'-2500',description:'FICTIONAL FEE',posted_at:'2024-04-01T06:59:59Z',statement_id:null}]};
it('reconciles exact bigint amounts and sanitizes spreadsheet text without leaking extra fields',()=>{
 const data=monthlyFundsSchema.parse({...report,source_reference:'PRIVATE',fx:'PRIVATE'});const csv=monthlyFundsCsv(data,true);expect(csv).toContain('90071992547484.93');expect(csv).toContain("'=FICTIONAL()");expect(csv).toContain("'=unsafe()");expect(csv).not.toContain('PRIVATE');expect(csv).toContain('100.00');expect(csv).toContain('25.00');
});
it('rejects mismatched totals, missing rows, duplicated rows and wrong local posting month',()=>{
 expect(monthlyFundsSchema.safeParse({...report,closing_minor:'0'}).success).toBe(false);
 expect(monthlyFundsSchema.safeParse({...report,closing_minor:'invalid'}).success).toBe(false);
 expect(monthlyFundsSchema.safeParse({...report,entries:[{...report.entries[0],posted_at:'invalid'},report.entries[1]]}).success).toBe(false);
 expect(monthlyFundsSchema.safeParse({...report,entries:report.entries.slice(0,1)}).success).toBe(false);
 expect(monthlyFundsSchema.safeParse({...report,entries:[report.entries[0],report.entries[0]]}).success).toBe(false);
 expect(monthlyFundsSchema.safeParse({...report,entries:[{...report.entries[0],posted_at:'2024-03-01T07:59:59Z'},report.entries[1]]}).success).toBe(false);
});
it('uses the last ended Vancouver month across UTC and year boundaries',()=>{
 expect(lastEndedFundsMonth(new Date('2024-04-01T06:00:00Z'))).toBe('2024-02');
 expect(lastEndedFundsMonth(new Date('2024-04-01T07:00:00Z'))).toBe('2024-03');
 expect(lastEndedFundsMonth(new Date('2024-01-10T00:00:00Z'))).toBe('2023-12');
});
