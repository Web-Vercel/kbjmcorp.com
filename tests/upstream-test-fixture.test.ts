import {it,expect} from 'vitest';
import {upstreamTestPdf} from '@/lib/billing/upstream-test-fixture';
it('creates an ASCII PDF with correct offsets and explicit nonpayment notice',()=>{
 const pdf=upstreamTestPdf('TEST-UPSTREAM-example','2026-11-16','45.30');expect(pdf.startsWith('%PDF-')).toBe(true);expect(pdf).toContain('NO BANK TRANSFER / NOT PROOF OF PAYMENT');expect(pdf).toContain('CAD 45.30');
 const at=Number(pdf.match(/startxref\n(\d+)/)?.[1]);expect(pdf.slice(at,at+4)).toBe('xref');
 for(const [index,line] of pdf.slice(at).split('\n').slice(3,8).entries())expect(pdf.slice(Number(line.slice(0,10)))).toMatch(new RegExp('^'+(index+1)+' 0 obj'));
});
