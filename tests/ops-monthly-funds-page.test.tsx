import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),context:{owner:false,canPrepare:false,canReview:true}}));
vi.mock('@/lib/operations/server',()=>({requireOperations:async()=>({client:{rpc:m.rpc,from:m.from},context:m.context})}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/operations/funds/page';
const company='b0000000-0000-4000-8000-000000000001',wallet='b0000000-0000-4000-8000-000000000002',statement='b0000000-0000-4000-8000-000000000003';
const data={wallet_id:wallet,organization_name:'FICTIONAL CLIENT',currency:'CNY',month:'2024-03-01',timezone:'America/Vancouver',generated_at:'2024-04-02T00:00:00Z',opening_minor:'10000',credits_minor:'0',debits_minor:'100',closing_minor:'9900',entry_count:1,complete:true,entries:[{id:'b0000000-0000-4000-8000-000000000004',kind:'ad_spend',description:'FICTIONAL CHARGE',amount_minor:'-100',posted_at:'2024-03-02T00:00:00Z',statement_id:statement,statement_month:'2024-02-01'}]};
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company,month:'2024-03'})}).then(renderToStaticMarkup);
beforeEach(()=>{vi.clearAllMocks();m.context.canReview=true;m.from.mockReturnValue({select:()=>({order:()=>({limit:async()=>({data:[{id:company,name:'FICTIONAL CLIENT'}],error:null})})})});m.rpc.mockResolvedValue({data:{...data,fx:'PRIVATE'},error:null});});
it('shows client-equivalent totals with the correct settlement-month link and download',async()=>{
 const html=await render();expect(m.rpc).toHaveBeenCalledWith('get_ops_monthly_funds',{p_org:company,p_month:'2024-03-01'});expect(html).toContain('CNY 99.00');expect(html).toContain('下载本月资金对账单');expect(html).toContain(`company=${company}&amp;month=2024-02#statement-${statement}`);expect(html).not.toContain('/account/statements');expect(html).not.toContain('PRIVATE');
});
it('separates a known missing wallet from a failed or mismatched report',async()=>{
 m.rpc.mockResolvedValue({data:null,error:null});let html=await render();expect(html).toContain('尚未开立人民币资金账户');expect(html).not.toContain('下载本月');
 m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE ERROR'}});html=await render();expect(html).toContain('资金对账暂不可用');expect(html).not.toContain('尚未开立人民币资金账户');expect(html).not.toContain('PRIVATE ERROR');
 m.rpc.mockResolvedValue({data:{...data,month:'2024-02-01'},error:null});expect(await render()).toContain('资金对账暂不可用');
});
it('blocks nonfinance staff before reading organizations or money',async()=>{
 m.context.canReview=false;await expect(render()).rejects.toThrow('NOT_FOUND');expect(m.from).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();
});
