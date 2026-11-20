import {expect,it} from 'vitest';
import {acceptanceSourceCopy} from '@/lib/ads/acceptance-source';
import {acceptanceOriginal,sourceId,testOrg,realOrg} from './fixtures/acceptance-source';
it('creates a deterministic isolated identity and retains provenance without changing the original',()=>{
 const original=JSON.stringify(acceptanceOriginal),copy=acceptanceSourceCopy(acceptanceOriginal,sourceId,testOrg,realOrg);
 expect(copy).toEqual(acceptanceSourceCopy(acceptanceOriginal,sourceId,testOrg,realOrg));expect(JSON.stringify(acceptanceOriginal)).toBe(original);
 expect(copy.report.account.id).not.toBe(acceptanceOriginal.account.id);expect(copy.report.account.name).toContain('非真实广告账户');expect(copy.report.daily).toEqual(acceptanceOriginal.daily);expect(copy.report.periodSpendMicros).toBe('36240000');expect(copy.report.acceptanceProvenance.sourceSnapshotId).toBe(sourceId);expect(JSON.stringify(copy)).not.toContain('PRIVATE ORIGINAL');
 const revision=acceptanceSourceCopy(acceptanceOriginal,'c0000000-0000-4000-8000-000000000002',testOrg,realOrg);expect(revision.report.account.id).toBe(copy.report.account.id);expect(revision.requestId).not.toBe(copy.requestId);
});
it('rejects incomplete, mismatched, already-copied and unsupported sources',()=>{
 for(const input of [{...acceptanceOriginal,check:'difference'},{...acceptanceOriginal,coverageKind:'pending'},{...acceptanceOriginal,periodSpendMicros:'1'},{...acceptanceOriginal,until:'2026-10-30'},{...acceptanceOriginal,account:{...acceptanceOriginal.account,currency_code:'USD'}},{...acceptanceOriginal,account:{...acceptanceOriginal.account,id:'adacct_acceptance_existing'}}])expect(()=>acceptanceSourceCopy(input,sourceId,testOrg,realOrg)).toThrow();
});
