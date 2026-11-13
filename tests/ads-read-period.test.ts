import {it,expect} from 'vitest';
import {readPeriod,sameReadSelection} from '../src/lib/ads/read-period';
const now=new Date('2026-11-09T12:00:00Z');
it('derives month-to-date from the account timezone and excludes today',()=>{
 expect(readPeriod({mode:'month_to_date'},now,'America/Vancouver')).toEqual({since:'2026-11-01',until:'2026-11-08'});
 expect(()=>readPeriod({mode:'month_to_date'},new Date('2026-11-01T12:00:00Z'),'America/Vancouver')).toThrow();
 expect(readPeriod({mode:'month_to_date'},new Date('2026-11-01T02:00:00Z'),'America/Vancouver')).toEqual({since:'2026-10-01',until:'2026-10-30'});
});
it('bounds custom windows to completed dates and 31 days without assuming fixed-length timezone days',()=>{
 expect(readPeriod({mode:'custom',since:'2026-10-01',until:'2026-10-31'},now,'UTC')).toEqual({since:'2026-10-01',until:'2026-10-31'});
 expect(readPeriod({mode:'custom',since:'2026-11-08',until:'2026-11-08'},now,'UTC').until).toBe('2026-11-08');
 for(const range of [{since:'2026-10-01',until:'2026-11-01'},{since:'2026-11-09',until:'2026-11-09'},{since:'2026-11-08',until:'2026-11-07'},{since:'2025-01-01',until:'2025-01-02'}])expect(()=>readPeriod({mode:'custom',...range},now,'UTC')).toThrow();
});
it('recognizes exact retry selection and legacy periods without confusing query purposes',()=>{
 const stored={selection:{mode:'month_to_date'},since:'2026-11-01',until:'2026-11-08'};
 expect(sameReadSelection(stored,{mode:'month_to_date'})).toBe(true);
 expect(sameReadSelection(stored,{mode:'custom',since:stored.since,until:stored.until})).toBe(false);
 expect(sameReadSelection({since:'2026-10-25',until:'2026-10-31'},{mode:'week'})).toBe(true);
 expect(sameReadSelection({since:'2026-10-01',until:'2026-10-31'},{mode:'month',month:'2026-10-01'})).toBe(true);
 expect(sameReadSelection({since:'2026-10-01',until:'2026-10-31'},{mode:'month_to_date'})).toBe(false);
});
