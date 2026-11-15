import {beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({guard:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.guard}));
vi.mock('@/lib/operations/staff-directory',()=>({operatingStaffEmails:async()=>new Map()}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('NOT_FOUND')},redirect:(url:string)=>{throw Error(`REDIRECT:${url}`)},useRouter:()=>({replace:vi.fn()})}));
import Workspace from '@/components/operations/OperationsWorkspace';
const props={params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({})};
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({client:{from:m.from,rpc:m.rpc},user:{id:'staff'},context:{owner:false,roles:[{unit:'zhidian_cn',role:'finance_preparer'}],canSource:false,canPrepare:true,canReview:false,canSupport:false}})});
it('shows task destinations without unrelated forms or fetching their records on the overview',async()=>{
 const html=renderToStaticMarkup(await Workspace(props));
 expect(html).toContain('/zh/operations/manual-sources');expect(html).toContain('/zh/operations/manual-finance');expect(html).toContain('/zh/operations/service-requests');expect(html).not.toContain('<form');expect(html).not.toContain('name="action"');expect(m.from).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledWith('get_home_attention');
});
it.each(['staff','manual-accounts'] as const)('rejects direct access to %s for a finance preparer',async view=>{await expect(Workspace({...props,view})).rejects.toThrow('NOT_FOUND');expect(m.from).not.toHaveBeenCalled()});
it('rejects finance and service pages for ad operations without those responsibilities',async()=>{
 m.guard.mockResolvedValue({client:{from:m.from},context:{owner:false,roles:[{unit:'kbjm_ca',role:'ad_operations'}],canSource:true,canPrepare:false,canReview:false,canSupport:false}});
 for(const view of ['manual-finance','fund-summary','service-requests'] as const)await expect(Workspace({...props,view})).rejects.toThrow('NOT_FOUND');expect(m.from).not.toHaveBeenCalled();
});
it('preserves legacy ticket and company links when moving them to dedicated pages',async()=>{
 await expect(Workspace({...props,searchParams:Promise.resolve({ticket:'ticket-id'})})).rejects.toThrow('REDIRECT:/zh/operations/service-requests?ticket=ticket-id');
 await expect(Workspace({...props,searchParams:Promise.resolve({company:'company-id',month:'2026-10'})})).rejects.toThrow('REDIRECT:/zh/operations/fund-summary?company=company-id&month=2026-10');
});
