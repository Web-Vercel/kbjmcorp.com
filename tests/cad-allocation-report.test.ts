import {it,expect} from 'vitest';
import {buildCadAllocationReport,cadAllocationReportCsv} from '@/lib/operations/cad-allocation-report';
import {reportInput,report,id} from './fixtures/cad-allocation-report';
it('reconciles selected-month CAD without treating a cross-month whole receipt or rejected/reversed revisions as verified',()=>{
 const r=report();expect(r).not.toBeNull();expect(r.procurement_minor).toBe('10000');expect(r.verified_minor).toBe('8000');expect(r.pending_minor).toBe('1000');expect(r.remaining_minor).toBe('2000');expect(r.pending_reversal_count).toBe(1);expect(r.registrations[0]).toMatchObject({registered_minor:'13000',selected_minor:'8000',other_month_minor:'5000'});expect(r.allocations).toHaveLength(4);expect(r.allocations.find(a=>a.payment_id===id(6))?.verified_minor).toBe('0');
 const cents=reportInput();cents.data.payments[0].received_cad_minor='13001';cents.data.payments[0].allocations[0].amount_cad_minor='8001';cents.data.statements[0].procurement_cad_minor='10001';cents.data.statements[0].verified_cad_minor='8001';const exact=buildCadAllocationReport(cents)!;expect(exact.verified_minor).toBe('8001');expect(exact.remaining_minor).toBe('2000');expect(cadAllocationReportCsv(exact,true)).toContain('80.01');
});
it('exports bank references intentionally, escapes spreadsheet strings and excludes originals, staff identities and off-month details',()=>{
 const r=report(),csv=cadAllocationReportCsv(r,true);expect(csv).toContain('FICTIONAL-BANK-3');expect(csv).toContain("'=FICTIONAL COMPANY()");expect(csv).toContain('80.00');expect(csv).toContain('130.00');expect(csv).toContain('整笔登记净到账可能分配到多个月份');expect(csv).not.toContain('PRIVATE');expect(JSON.stringify(r)).not.toContain(id(99));expect(JSON.stringify(r)).not.toContain(id(20));expect(csv).toContain('原核销已撤销');
});
it('rejects incomplete counts, mixed statement months, inconsistent receipt totals and contradictory per-statement sums',()=>{
 let input=reportInput();input.data.payment_count=101;expect(buildCadAllocationReport(input)).toBeNull();input=reportInput();input.data.statements[0].month='2024-02-01';expect(buildCadAllocationReport(input)).toBeNull();input=reportInput();input.data.payments[0].received_cad_minor='1';expect(buildCadAllocationReport(input)).toBeNull();input=reportInput();input.data.statements[0].verified_cad_minor='10000';expect(buildCadAllocationReport(input)).toBeNull();
});
it('treats a known empty scope as no posted statements and prevents a blank export',()=>{
 const input=reportInput();const r=buildCadAllocationReport({...input,data:{reversal_enabled:true,statement_count:0,payment_count:0,statements:[],payments:[]}});expect(r?.procurement_minor).toBe('0');expect(()=>cadAllocationReportCsv(r!,true)).toThrow(/No posted/);
 const zero=buildCadAllocationReport({...input,data:{reversal_enabled:true,statement_count:1,payment_count:0,statements:[{...input.data.statements[0],procurement_cad_minor:'0',verified_cad_minor:'0',pending_cad_minor:'0'}],payments:[]}})!;expect(zero).not.toBeNull();expect(cadAllocationReportCsv(zero,true)).toContain(id(2));
});
