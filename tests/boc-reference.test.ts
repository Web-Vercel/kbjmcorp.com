import {expect,it} from 'vitest';
import {parseBocReference} from '@/lib/billing/boc-reference';
const data={observations:[{d:'2026-11-06',FXCNYCAD:{v:'0.20000000'}}]};
it('inverts CNY/CAD to explicit CAD/CNY without floats and preserves actual source date',()=>{expect(parseBocReference(data,new Date('2026-11-07T12:00:00Z'))).toMatchObject({rate:'5.00000000',date:'2026-11-06',originalCnyCad:'0.20000000',source:'Bank of Canada'});});
it('rejects stale, future, missing and zero quotes',()=>{for(const now of ['2026-11-20','2026-11-01'])expect(()=>parseBocReference(data,new Date(now))).toThrow();expect(()=>parseBocReference({observations:[]})).toThrow();expect(()=>parseBocReference({observations:[{d:'2026-11-06',FXCNYCAD:{v:'0'}}]},new Date('2026-11-07'))).toThrow();});
