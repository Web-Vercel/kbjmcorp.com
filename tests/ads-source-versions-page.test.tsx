import {beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({operations:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
vi.mock('next/navigation',()=>({notFound:()=>{throw Error('not found');}}));
import Page from '@/app/[locale]/operations/source-data/page';
const org='b0000000-0000-4000-8000-000000000001';
const base={account_id:'adacct_test',account_name:'Fictional Account',currency:'CAD',timezone:'America/Vancouver',source_check:'difference',daily_spend_micros:'1000000',period_spend_micros:'2000000',missing_dates:[],end_boundary:null,source_sha256:'a'.repeat(64),retrieved_at:'2026-11-01T00:00:00Z',shared_at:'2026-11-02T00:00:00Z',note:'Fictional source evidence',daily:[],settlement_ready:false};
const rows=[{...base,id:'first',snapshot_id:'first-data',since:'2026-10-01',until:'2026-10-31'},{...base,id:'second',snapshot_id:'second-data',since:'2026-10-31',until:'2026-11-06',coverage_reason:'not_closed_cad_month'}];
beforeEach(()=>{vi.clearAllMocks();const chain={select:()=>chain,order:()=>chain,limit:async()=>({data:[{id:org,name:'Fictional company'}],error:null})};m.operations.mockResolvedValue({context:{owner:true},client:{from:()=>chain,rpc:m.rpc}});m.rpc.mockResolvedValue({data:rows,error:null});});
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org})}).then(renderToStaticMarkup);
it('groups by stable account identity without merging periods, amounts or downloads',async()=>{
 const html=await render();expect(html.match(/<h2>Fictional Account/g)).toHaveLength(1);expect(html).toContain('2026-10-01');expect(html).toContain('2026-10-31');expect(html).toContain('2026-11-06');expect(html).toContain('first-data');expect(html).toContain('second-data');expect(html.match(/下载本版本报告（CSV）/g)).toHaveLength(2);expect(html).not.toContain('<details open');
 const body=html.split('id="source-handoff-first"')[1].split('</article>')[0];expect(body.lastIndexOf('来源金额有差异')).toBeGreaterThan(body.lastIndexOf('</details>'));
});
it('keeps identically named accounts separate when their IDs differ',async()=>{m.rpc.mockResolvedValue({data:[rows[0],{...rows[1],account_id:'adacct_other'}],error:null});expect((await render()).match(/<h2>Fictional Account/g)).toHaveLength(2);});
it('does not turn lookup errors into an empty or successful report',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});const html=await render();expect(html).toContain('来源交接记录暂不可用');expect(html).not.toContain('PRIVATE');expect(html).not.toContain('下载本版本报告');});
