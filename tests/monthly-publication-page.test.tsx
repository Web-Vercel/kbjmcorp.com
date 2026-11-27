import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),notFound:()=>{throw new Error('Not found');}}));
const m=vi.hoisted(()=>({operations:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
import Page from '@/app/[locale]/operations/settlements/page';
const org='b0000000-0000-4000-8000-000000000001';
const draft={id:'draft-example',month:'2024-01-01',snapshot_id:'source-example',quote_id:'c0000000-0000-4000-8000-000000000001',quote_revision:1,source_cad_minor:'10000',total_cny_minor:'50000',agreement_reference:'Verified agreement',note:'Preparation note',prepared_by:'preparer',status:'approved',review_note:'Reviewed',quote_archived:false};
function setup(owner:boolean,receipts:unknown[]=[],status='approved'){
 const chain={select:()=>chain,order:()=>chain,limit:async()=>({data:[{id:org,name:'FICTIONAL COMPANY'}],error:null})};
 m.operations.mockResolvedValue({user:{id:'current-user'},context:{owner,canPrepare:false,canReview:true},client:{from:()=>chain,rpc:async(name:string)=>({error:null,data:name==='list_monthly_settlements'?[{...draft,status}]:name==='list_monthly_statement_receipts'?receipts:[]})}});
}
beforeEach(()=>vi.clearAllMocks());
const render=async()=>renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({})}));
it('offers formal publication only to administrators after independent approval',async()=>{
 setup(false);expect(await render()).not.toContain('正式发布并扣余额 CNY');
 setup(true,[],'pending');expect(await render()).not.toContain('正式发布并扣余额 CNY');
 setup(true);const html=await render();expect(html).toContain('正式发布并扣余额 CNY 500.00');expect(html).toContain('本操作会让客户看到账单');
});
it('replaces publication controls with the immutable receipt once posted',async()=>{
 setup(true,[{id:'statement-example',draft_id:draft.id,month:draft.month,total_cny_minor:'50000',published_at:'2026-01-01T00:00:00Z'}]);const html=await render();expect(html).toContain('已正式发布 · 已完成余额记账');expect(html).toContain('statement-example');expect(html).not.toContain('正式发布并扣余额 CNY');
});

it('carries the selected company/month into source prerequisite recovery',async()=>{
 setup(true);const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01',mode:'prepare'})}));
 expect(html).toContain('当前筛选下尚无可访问的已交接来源');expect(html).toContain(`/zh/operations/source-data?company=${org}&amp;month=2024-01`);expect(html).toContain('列表为空不表示广告花费为零');
});
it('keeps failed source lookups distinct from a successfully empty source list',async()=>{
 setup(true);const state=await m.operations();state.client.rpc=async()=>({data:null,error:{message:'PRIVATE SOURCE ERROR'}});m.operations.mockResolvedValue(state);
 const html=await render();expect(html).toContain('记录暂不可用');expect(html).not.toContain('当前筛选下尚无可访问的已交接来源');expect(html).not.toContain('PRIVATE SOURCE ERROR');
});


it('connects a rejected draft to its original quote revision while retaining the actual draft month',async()=>{
 setup(true,[],'rejected');const html=await render();expect(html).toContain(`/zh/operations/pricing?company=${org}&amp;month=2024-01&amp;edit=${draft.quote_id}#quote-editor`);expect(html).not.toContain('正式发布并扣余额 CNY');
 setup(false,[],'rejected');const finance=await render();expect(finance).not.toContain(`edit=${draft.quote_id}`);expect(finance).toContain('请管理员修订');
});
it('matches the approved draft publication anchor and never routes a posted draft back to revision',async()=>{
 setup(true);let html=await render();expect(html).toContain(`href="#publish-draft-${draft.id}"`);expect(html).toContain(`id="publish-draft-${draft.id}"`);
 setup(true,[{id:'statement-example',draft_id:draft.id,month:draft.month,total_cny_minor:'50000',published_at:'2026-01-01T00:00:00Z'}]);html=await render();expect(html).not.toContain(`edit=${draft.quote_id}`);expect(html).not.toContain(`href="#publish-draft-${draft.id}"`);expect(html).toContain('核查本月公司间到账与核销');
});
it('places account overview before the history-month filter and keeps secondary workflows closed',async()=>{
 setup(true);const html=await render();
 expect(html).toContain('<h1>账单工作台</h1>');expect(html.indexOf('账户结算概况')).toBeLessThan(html.indexOf('查阅月份（留空查看近期历史）'));
 expect(html).toContain('<summary>更多操作与月度详情</summary>');expect(html).toContain('view=details');
 expect(html).not.toContain('进度在哪里，下一步谁来做');expect(html).not.toContain('账户办理列表');expect(html).not.toContain('name="month" default');
});
it('opens the explicitly requested draft even when another pending draft appears first',async()=>{
 setup(true,[],'pending');const state=await m.operations();const original=state.client.rpc;
 const first='d0000000-0000-4000-8000-000000000001',target='d0000000-0000-4000-8000-000000000002';
 state.client.rpc=async(name:string)=>name==='list_monthly_settlements'?{data:[{...draft,id:first,status:'pending'},{...draft,id:target,status:'pending'}],error:null}:original(name);
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01',draft:target})}));
 expect(html).toContain(`id="draft-${target}"`);expect(html).not.toContain(`id="draft-${first}"`);expect(html).toContain('<details class="admin-panel" open=""');
 const missing=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01',draft:'d0000000-0000-4000-8000-000000000003'})}));
 expect(missing).toContain('所选草稿不在当前企业');expect(missing).not.toContain(`id="draft-${first}"`);
});
