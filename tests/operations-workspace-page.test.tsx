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
it('reads saved manual links and all staff assignment states without asking for another save',async()=>{
 m.guard.mockResolvedValue({client:{from:m.from,rpc:m.rpc},user:{id:'staff'},context:{owner:true,roles:[],canSource:true,canPrepare:true,canReview:true,canSupport:true}});
 m.from.mockImplementation((table:string)=>{const data=table==='organizations'?[{id:'org',name:'SAVED COMPANY'}]:table==='ad_accounts'?[{id:'account',organization_id:'org',label:'SAVED MANUAL ACCOUNT',external_id:'adacct_saved',connection_status:'unverified'}]:[];const q:any={};for(const key of ['select','order','limit','eq','in'])q[key]=()=>q;q.then=(resolve:any,reject:any)=>Promise.resolve({data,error:null}).then(resolve,reject);return q;});
 m.rpc.mockImplementation(async(name:string)=>({data:name==='list_operating_staff'?[{user_id:'staff',role:'operator',active:true,assignments:[{unit:'kbjm_ca',role:'ad_operations',active:false},{unit:'zhidian_cn',role:'finance_reviewer',active:true}]}]:[],error:null}));
 const links=renderToStaticMarkup(await Workspace({...props,view:'manual-accounts'}));expect(links).toContain('已保存的账户归属关联');expect(links).toContain('SAVED MANUAL ACCOUNT');expect(links).toContain('adacct_saved');expect(links).toContain('手工关联');
 const staff=renderToStaticMarkup(await Workspace({...props,view:'staff'}));expect(staff).toContain('查看已保存的单位与职责');expect(staff).toContain('KBJM · Canada');expect(staff).toContain('职责已撤销');expect(staff).toContain('中国财务复核');
});
