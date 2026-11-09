import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {statement} from './fixtures/client-statement';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/client/page',()=>({requireClientPage:async()=>({client:{rpc:m.rpc}})}));
vi.mock('@/components/SiteHeader',()=>({default:()=>null}));vi.mock('@/components/SiteFooter',()=>({default:()=>null}));
import Page from '@/app/[locale]/account/statements/page';
beforeEach(()=>vi.clearAllMocks());
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
