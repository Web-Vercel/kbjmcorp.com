import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {statement} from './fixtures/client-statement';
const m=vi.hoisted(()=>({rpc:vi.fn(),guard:vi.fn()}));
vi.mock('@/lib/client/page',()=>({requireClientPage:m.guard}));
vi.mock('@/components/SiteHeader',()=>({default:()=>null}));vi.mock('@/components/SiteFooter',()=>({default:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
import Page from '@/app/[locale]/account/statements/page';
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({client:{rpc:m.rpc}});});
const render=()=>Page({params:Promise.resolve({locale:'zh'})}).then(renderToStaticMarkup);
it('offers customer exports only for validated published statement data',async()=>{
 m.rpc.mockResolvedValue({data:[{...statement,rawResponses:'PRIVATE_RAW'}],error:null});const html=await render();expect(html).toContain('下载本账单（CSV）');expect(html).toContain('1313.46');expect(html).not.toContain('PRIVATE_RAW');expect(m.rpc).toHaveBeenCalledWith('get_client_monthly_statements');
});
it('shows unknown service state instead of exports or zero charges for invalid data',async()=>{
 m.rpc.mockResolvedValue({data:[{...statement,total_minor:'1'}],error:null});let html=await render();expect(html).toContain('账单暂不可用');expect(html).not.toContain('下载本账单');
 m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});html=await render();expect(html).toContain('不能据此认定没有费用');expect(html).not.toContain('PRIVATE');
});
it('explains membership and finance authorization when no statements are visible',async()=>{
 m.rpc.mockResolvedValue({data:[],error:null});const html=await render();expect(html).toContain('开通财务查看权限');expect(html).not.toContain('下载本账单');
});
it('does not trust reading receipts returned alongside a lookup error',async()=>{
 m.rpc.mockImplementation(async(name:string)=>name==='get_client_monthly_statements'?{data:[statement],error:null}:{data:[{statement_id:statement.id,confirmed_at:'2026-11-01T00:00:00Z'}],error:{message:'PRIVATE'}});
 const html=await render();expect(html).toContain('查阅确认记录暂不可用');expect(html).not.toContain('您已确认查阅');expect(html).toContain('下载本账单（CSV）');
});
it('passes wallet, month and statement filters to the database instead of filtering a limited list',async()=>{
 const wallet='b0000000-0000-4000-8000-000000000002';m.rpc.mockImplementation(async(name:string)=>name==='get_client_wallets'?{data:[{id:wallet,organization_name:'FICTIONAL CLIENT',currency:'CNY'}],error:null}:name==='get_client_monthly_statements'?{data:[{...statement,wallet_id:wallet}],error:null}:{data:[],error:null});
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({wallet,month:'2026-10',statement:statement.id})}));expect(m.rpc).toHaveBeenCalledWith('get_client_monthly_statements',{p_wallet:wallet,p_month:'2026-10-01',p_statement:statement.id});expect(m.guard).toHaveBeenCalledWith('zh',`/zh/account/statements?wallet=${wallet}&month=2026-10&statement=${statement.id}#statement-${statement.id}`);expect(html).toContain(`id="statement-${statement.id}"`);expect(html).toContain(`/zh/account?wallet=${wallet}#transactions`);
});
it('explains unavailable direct statement links without revealing another company or pretending to switch accounts',async()=>{
 m.rpc.mockResolvedValue({data:[],error:null});const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({statement:statement.id})}));
 expect(html).toContain('该账单不存在或当前账号无权查看');expect(html).toContain('当前使用的账号和企业显示在页面顶部');expect(html).toContain('查看我有权访问的账单');expect(html).not.toContain('下载本账单');expect(html).not.toContain('1313.46');expect(html).not.toContain('请确认已关联客户企业');
});
it('keeps a failed query distinct from an inaccessible statement and refuses a different returned ID',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});const query={statement:statement.id};let html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve(query)}));expect(html).toContain('账单暂不可用');expect(html).not.toContain('该账单不存在或当前账号无权查看');
 m.rpc.mockImplementation(async(name:string)=>name==='get_client_monthly_statements'?{data:[{...statement,id:'b0000000-0000-4000-8000-000000000099'}],error:null}:{data:[],error:null});html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve(query)}));expect(html).toContain('账单暂不可用');expect(html).not.toContain('下载本账单');
});
