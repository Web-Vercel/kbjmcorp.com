import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({operations:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));vi.mock('@/lib/collections/test-mode',()=>({collectionTestOrganization:()=>null}));
import Page from '@/app/[locale]/operations/month-close/page';
const id='b0000000-0000-4000-8000-000000000001';
const overview={organization_id:id,month:'2026-10-01',wallet_id:id,balance_minor:'39500',pending_receipt_count:0,pending_receipt_minor:'0',accounts:[{binding_id:id,account_id:'adacct_fictional',account_label:'FICTIONAL',active:true,timezone:'America/Vancouver',stage:'published',source_id:id,source_ready:true,coverage_reason:null,coverage_kind:'complete_rows',source_cad_minor:null,operational_source_count:0,quote_match_count:0,coverage_prepared_by_me:false,draft_id:id,draft_prepared_by_me:false,draft_total_cny_minor:'60500',newer_shared_source:false,statement_id:id,published_at:'2026-11-01T00:00:00Z',posted_total_cny_minor:'60500'}]};
function setup(owner=true){const chain={select:()=>chain,order:()=>chain,limit:async()=>({data:[{id,name:'FICTIONAL COMPANY'}],error:null})};m.operations.mockResolvedValue({context:{owner,canPrepare:false,canReview:true},client:{from:()=>chain,rpc:m.rpc}});m.rpc.mockImplementation(async(name:string)=>({error:null,data:name==='get_month_close_overview'?overview:name==='get_crm_members'?[{finance_role:'viewer',phone_hint:'PRIVATE PHONE'}]:name==='get_statement_question_workbench'?{organization_id:id,month:'2026-10-01',total_count:0,open_count:0,in_progress_count:0,resolved_count:0,truncated:false,rows:[]}:name==='get_statement_read_status'?{statement_count:1,statements:[{statement_id:id,confirmation_count:0,last_confirmed_at:null}]}:{reversal_enabled:true,statement_count:1,payment_count:0,statements:[{id,account_name:'FICTIONAL',month:'2026-10-01',procurement_cad_minor:'11000',verified_cad_minor:'0',pending_cad_minor:'0'}],payments:[]}}));}
beforeEach(()=>{vi.clearAllMocks();setup();});
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:id,month:'2026-10'})}).then(renderToStaticMarkup);
it('shows five read-only workflow steps, collapses detail and never exposes member contact hints',async()=>{const html=await render();expect(html).toContain('主流程：只看这五项');expect(html).toContain('<summary>查看各结算步骤</summary>');expect(html).toContain('尚未收到这些账单的查阅确认');expect(html).not.toContain('PRIVATE PHONE');expect(m.rpc.mock.calls.map(c=>c[0]).sort()).toEqual(['get_crm_members','get_month_close_overview','get_statement_question_workbench','get_statement_read_status','get_upstream_payment_workbench']);});
it('never queries admin-only client membership data for a finance reviewer',async()=>{setup(false);const html=await render();expect(m.rpc.mock.calls.map(c=>c[0])).not.toContain('get_crm_members');expect(html).toContain('尚未收到这些账单的查阅确认');});
it('preserves the published statement while reporting missing payment lookup as unknown',async()=>{m.rpc.mockImplementation(async(name:string)=>name==='get_month_close_overview'?{data:overview,error:null}: {data:null,error:{message:'PRIVATE ERROR'}});const html=await render();expect(html).toContain('账单已发布');expect(html).toContain('不能据此认定已经结清');expect(html).not.toContain('PRIVATE ERROR');});

it('keeps question lookup failures visible without hiding posted statements or inferring zero pending issues',async()=>{
 m.rpc.mockImplementation(async(name:string)=>name==='get_month_close_overview'?{data:overview,error:null}:{data:null,error:{message:'PRIVATE ERROR'}});const html=await render();expect(html).toContain('账单问题状态暂不可用');expect(html).toContain('不能据此认定没有待处理问题');expect(html).toContain('账单已发布');expect(html).not.toContain('PRIVATE ERROR');expect(html).not.toContain('本月暂未发现账单关联工单');
});

it('offers an internal checklist only after all report dependencies are validated',async()=>{
 let html=await render();expect(html).toContain('下载内部月结办理清单（CSV）');expect(html).not.toContain('disabled=""');
 m.rpc.mockImplementation(async(name:string)=>name==='get_month_close_overview'?{data:overview,error:null}:{data:null,error:{message:'PRIVATE ERROR'}});html=await render();expect(html).toContain('disabled=""');expect(html).toContain('暂不提供清单下载');expect(html).not.toContain('PRIVATE ERROR');
});


it('connects role-specific tasks to the exact account card without adding RPC calls',async()=>{
 const original=m.rpc.getMockImplementation()!;
 m.rpc.mockImplementation(async(name:string,...args:unknown[])=>name==='get_month_close_overview'?{error:null,data:{...overview,accounts:[{...overview.accounts[0],stage:'settlement_review_needed',draft_prepared_by_me:true,statement_id:null}]}}:original(name,...args));
 const html=await render();expect(html).toContain('本账号月结待办');expect(html).toContain('本人已制单，须由另一账号独立复核');expect(html).toContain(`href="#month-close-account-${id}"`);expect(html).toContain(`id="month-close-account-${id}"`);
 expect(m.rpc.mock.calls.map(c=>c[0]).sort()).toEqual(['get_month_close_overview','get_statement_question_workbench']);
});
