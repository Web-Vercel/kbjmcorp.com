import {reportInput} from './fixtures/cad-allocation-report';
import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({operations:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));vi.mock('next/navigation',()=>({notFound:()=>{throw Error('Not found');},useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Page from '@/app/[locale]/operations/upstream-payments/page';
const org='b0000000-0000-4000-8000-000000000001',user='a0000000-0000-4000-8000-000000000001',other='a0000000-0000-4000-8000-000000000002';
const payment={id:org,revision:1,bank_reference:'FICTIONAL-REF',received_on:'2026-10-31',received_cad_minor:'2000',evidence_reference:'ARCHIVE ORIGINAL',evidence_sha256:'a'.repeat(64),note:'Canada net receipt',prepared_by:user,prepared_at:'2026-11-01T00:00:00Z',status:'pending',review_note:null,reviewed_at:null,allocations:[{statement_id:org,amount_cad_minor:'2000',month:'2026-10-01',account_name:'FICTIONAL ACCOUNT'}]};
const work={statement_count:1,payment_count:1,statements:[{id:org,account_name:'FICTIONAL ACCOUNT',month:'2026-10-01',procurement_cad_minor:'10000',verified_cad_minor:'2000',pending_cad_minor:'3000'}],payments:[payment]};
function setup(who=user,owner=true){const chain={select:()=>chain,order:()=>chain,limit:async()=>({data:[{id:org,name:'FICTIONAL COMPANY'}],error:null})};m.operations.mockResolvedValue({user:{id:who},context:{owner,canPrepare:false,canReview:true},client:{from:()=>chain,rpc:m.rpc}});m.rpc.mockResolvedValue({data:work,error:null});}
beforeEach(()=>{vi.clearAllMocks();setup();});
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({month:'2026-10',company:org})}).then(renderToStaticMarkup);
it('separates verified, pending and unreconciled amounts and blocks self-review even for an admin',async()=>{const html=await render();expect(html).toContain('尚未核销 CAD 80.00');expect(html).toContain('待复核分配 CAD 30.00');expect(html).toContain('必须由另一位');expect(html).not.toContain('保存独立复核结果');});
it('offers independent review to another reviewer but no registration form',async()=>{setup(other,false);const html=await render();expect(html).toContain('保存独立复核结果');expect(html).not.toContain('登记加拿大 CAD 净到账与账单分配');});
it('does not present a failed lookup as reconciled procurement',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});const html=await render();expect(html).toContain('尚不能确认核销状态');expect(html).not.toContain('PRIVATE');expect(html).not.toContain('保存独立复核结果');});

it('offers an internal report and links the original settlement while preserving company/month scope',async()=>{
 m.rpc.mockResolvedValue({data:reportInput().data,error:null});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01'})}));expect(html).toContain('下载内部CAD核销报告（CSV）');expect(html).toContain('CAD 80.00');expect(html).toContain('CAD 20.00');expect(html).toContain(`company=${org}&amp;month=2024-01#statement-`);
});
it('leaves original records visible but disables summary exports when history is truncated',async()=>{
 const data=reportInput().data;m.rpc.mockResolvedValue({data:{...data,payment_count:101},error:null});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01'})}));expect(html).toContain('未知合计不显示为零');expect(html).toContain('FICTIONAL-BANK-3');expect(html).not.toContain('下载内部CAD核销报告（CSV）');
});
it('does not expose banking reports to staff without a finance role',async()=>{
 m.operations.mockResolvedValue({context:{owner:false,canPrepare:false,canReview:false},client:{rpc:m.rpc},user:{id:user}});await expect(render()).rejects.toThrow('Not found');expect(m.rpc).not.toHaveBeenCalled();
});
