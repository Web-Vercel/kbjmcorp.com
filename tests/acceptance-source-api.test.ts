import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {acceptanceOriginal,sourceId,testOrg,realOrg} from './fixtures/acceptance-source';
const m=vi.hoisted(()=>({guard:vi.fn(),config:vi.fn(),org:vi.fn(),advertiser:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/admin/guard',()=>({getStaffContext:m.guard,staffError:(r:{error:string;status:number})=>new Response(JSON.stringify(r),{status:r.status})}));
vi.mock('@/lib/auth/config',()=>({getSessionConfig:m.config}));vi.mock('@/lib/collections/test-mode',()=>({collectionTestOrganization:m.org}));vi.mock('@/lib/ads/report-client',()=>({reportingConfig:m.advertiser}));
import {POST} from '@/app/api/admin/acceptance-source/route';
const request=(origin='https://fixture.test')=>new Request('https://fixture.test/api/admin/acceptance-source',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({snapshotId:sourceId,confirm:'on'})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('VERCEL_ENV','preview');m.config.mockReturnValue({url:'https://ziijwwbcpuynkaxsbdvg.supabase.co'});m.org.mockReturnValue(testOrg);m.advertiser.mockReturnValue({accountId:acceptanceOriginal.account.id});m.guard.mockResolvedValue({role:'admin',client:{from:m.from,rpc:m.rpc}});m.from.mockImplementation((table:string)=>({select:()=>({eq:()=>({abortSignal:()=>({maybeSingle:async()=>({error:null,data:table==='organizations'?{name:'财务流程验收企业（虚构）'}:table==='ads_reporting_snapshots'?{id:sourceId,account_id:acceptanceOriginal.account.id,report:acceptanceOriginal}:{organization_id:realOrg}})})})})}));m.rpc.mockReturnValue({abortSignal:async()=>({data:'d0000000-0000-4000-8000-000000000001',error:null})});});
afterEach(()=>vi.unstubAllEnvs());
it('blocks Production, wrong database, missing MFA and non-administrators before any copy',async()=>{
 vi.stubEnv('VERCEL_ENV','production');expect((await POST(request())).status).toBe(403);vi.stubEnv('VERCEL_ENV','preview');m.config.mockReturnValue({url:'https://rywmjguhvnppfxwhherl.supabase.co'});expect((await POST(request())).status).toBe(403);m.config.mockReturnValue({url:'https://ziijwwbcpuynkaxsbdvg.supabase.co'});m.guard.mockResolvedValue({error:'mfa_required',status:403});expect((await POST(request())).status).toBe(403);m.guard.mockResolvedValue({role:'operator'});expect((await POST(request())).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('requires same origin and dedicated test setup; never guesses a target company',async()=>{
 expect((await POST(request('https://attacker.test'))).status).toBe(403);m.org.mockReturnValue(null);expect((await POST(request())).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled();
});
it('creates only source, synthetic ownership and handoff; no money or grants',async()=>{
 const r=await POST(request());expect(r.status).toBe(200);expect((await r.json()).receipt).toMatchObject({organizationId:testOrg,period:'2026-10-01',notPayable:true});expect(m.rpc.mock.calls.map(c=>c[0])).toEqual(['save_ads_reporting_snapshot','bind_ads_reporting_account','share_ads_source_snapshot']);expect(m.rpc.mock.calls[0][1].p_report.account.id).toMatch(/^adacct_acceptance_/);expect(m.rpc.mock.calls[1][1].p_org).toBe(testOrg);
});
