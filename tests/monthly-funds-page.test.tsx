import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({rpc:vi.fn(),require:vi.fn(),header:vi.fn()}));
vi.mock('@/lib/client/page',()=>({requireClientPage:m.require}));
vi.mock('@/components/SiteHeader',()=>({default:(props:unknown)=>{m.header(props);return null;}}));vi.mock('@/components/SiteFooter',()=>({default:()=>null}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/account/funds/page';
const wallet='b0000000-0000-4000-8000-000000000001';
const data={wallet_id:wallet,organization_name:'FICTIONAL CLIENT',currency:'CNY',month:'2024-03-01',timezone:'America/Vancouver',generated_at:'2024-04-02T00:00:00Z',opening_minor:'10000',credits_minor:'0',debits_minor:'0',closing_minor:'10000',entry_count:0,complete:true,entries:[]};
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({wallet,month:'2024-03'})}).then(renderToStaticMarkup);
beforeEach(()=>{vi.clearAllMocks();m.require.mockResolvedValue({client:{rpc:m.rpc}});m.rpc.mockImplementation(async(name:string)=>name==='get_client_wallets'?{data:[{id:wallet,organization_name:'FICTIONAL CLIENT',currency:'CNY'}],error:null}:{data:{...data,fx:'PRIVATE'},error:null});});
it('shows a carried-forward zero-entry month with exact account query and a CSV download',async()=>{
 const html=await render();expect(m.rpc).toHaveBeenCalledWith('get_client_monthly_funds',{p_wallet:wallet,p_month:'2024-03-01'});expect(html).toContain('CNY 100.00');expect(html).toContain('期初余额结转');expect(html).toContain('下载本月资金对账单');expect(html).not.toContain('PRIVATE');
});
it('does not show exports or zero balances after RPC failure or invalid reconciliation',async()=>{
 m.rpc.mockImplementation(async(name:string)=>name==='get_client_wallets'?{data:[{id:wallet,organization_name:'FICTIONAL CLIENT',currency:'CNY'}],error:null}:{data:{...data,closing_minor:'1'},error:{message:'PRIVATE ERROR'}});
 const html=await render();expect(html).toContain('未将未知金额显示为零');expect(html).not.toContain('下载本月资金对账单');expect(html).not.toContain('PRIVATE ERROR');
});
it('rejects another wallet without querying its funds',async()=>{
 m.rpc.mockResolvedValue({data:[],error:null});await expect(render()).rejects.toThrow('NOT_FOUND');expect(m.rpc).toHaveBeenCalledTimes(1);
});
it('keeps the wallet and posting month in login return without the public marketing header',async()=>{
 await render();const path=`/zh/account/funds?wallet=${wallet}&month=2024-03`;
 expect(m.require).toHaveBeenCalledWith('zh',path);expect(m.header).not.toHaveBeenCalled();
});
it('does not read financial records when authentication redirects to sign-in',async()=>{
 m.require.mockRejectedValue(new Error('LOGIN_REDIRECT'));await expect(render()).rejects.toThrow('LOGIN_REDIRECT');expect(m.rpc).not.toHaveBeenCalled();
});
