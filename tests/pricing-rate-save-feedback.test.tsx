// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const m=vi.hoisted(()=>({refresh:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>m}));
import Settings from '@/components/operations/PricingRateSettings';
const company='b0000000-0000-4000-8000-000000000001';
const props={locale:'zh' as const,companies:[{id:company,name:'FICTIONAL'}],company,month:'2026-10',systemScope:false,stored:{revision:3,effective_month:'2026-10-01',canada_bps:null,china_bps:null,transfer_bps:null},effective:{canada:1500,china:2000,transfer:500},systemDefaults:{canada:1500,china:2000,transfer:500}};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('shows the database-confirmed zero waiver immediately and survives a stale parent refresh',async()=>{const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,saved:{...props.stored,revision:4,organization_id:company,transfer_bps:0}})});vi.stubGlobal('fetch',fetcher);const user=userEvent.setup();const view=render(<Settings {...props}/>);await user.type(screen.getByLabelText(/跨境支付费/),'0');await user.click(screen.getByRole('button',{name:'保存费率版本'}));expect(screen.getByText('该月适用 0% · 客户专属')).toBeTruthy();expect(screen.getByText('已读取费率版本：4')).toBeTruthy();expect(screen.getByText('已保存。')).toBeTruthy();expect(screen.getByText('该月适用 15% · 系统默认')).toBeTruthy();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({organizationId:company,month:'2026-10',canada:'',china:'',transfer:'0'});view.rerender(<Settings {...props}/>);expect(screen.getByText('该月适用 0% · 客户专属')).toBeTruthy();expect(m.refresh).toHaveBeenCalledOnce();});
