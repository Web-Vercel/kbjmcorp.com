import {expect,it} from 'vitest';
import {bocMonthWindow,bocMonthlyUrl,parseBocMonthlyReference} from '@/lib/billing/boc-monthly';
const now=new Date('2026-11-26T12:00:00Z');
const row=(d:string,v='0.2')=>({d,FXCNYCAD:{v}});
it('selects the last available release rather than the invoice issue date',()=>{
 const result=parseBocMonthlyReference({observations:[row('2026-10-29','0.25'),row('2026-10-30')]},'2026-10',now);
 expect(result).toMatchObject({date:'2026-10-30',rate:'5.00000000',billingMonth:'2026-10',policy:'month_end_last_published',fetchedAt:now.toISOString()});
 expect(bocMonthlyUrl('2026-10',now)).toContain('start_date=2026-10-01&end_date=2026-10-31');
});
it('handles leap years and publication timezone month boundaries',()=>{
 expect(bocMonthWindow('2024-02',now).end).toBe('2024-02-29');
 expect(()=>bocMonthWindow('2026-10',new Date('2026-11-01T00:30:00Z'))).toThrow();
});
it('rejects absent, stale, duplicate, out-of-period and malformed rates',()=>{
 for(const observations of [[],[row('2026-10-01')],[row('2026-11-01')],[row('2026-10-30'),row('2026-10-30')],[row('2026-10-30','0')],[row('2026-10-30','N/A')]])expect(()=>parseBocMonthlyReference({observations},'2026-10',now)).toThrow();
 for(const month of ['2026-11','2026-12','2026-13','bad'])expect(()=>bocMonthWindow(month,now)).toThrow();
});
