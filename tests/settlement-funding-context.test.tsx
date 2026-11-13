import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:async()=>({context:{owner:true,canPrepare:true,canReview:true},user:{id:'admin'},client:{rpc:m.rpc,from:m.from}})}));
vi.mock('@/lib/collections/test-mode',()=>({collectionTestOrganization:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/operations/settlements/page';
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const draft={id:id(4),month:'2024-01-01',snapshot_id:id(8),quote_id:id(9),quote_revision:1,source_cad_minor:'0',total_cny_minor:'40000',agreement_reference:'FICTIONAL AGREEMENT',note:'FICTIONAL PREPARATION',prepared_by:id(7),status:'approved',review_note:'FICTIONAL REVIEW',quote_archived:false};
const overview={organization_id:id(1),month:'2024-01-01',wallet_id:id(2),balance_minor:'60000',accounts:[3,5].map(n=>({binding_id:id(n),stage:'publication_ready',source_ready:true,draft_id:id(n+1),draft_status:'approved',draft_total_cny_minor:'40000',statement_id:null}))};
const questions={organization_id:id(1),month:'2024-01-01',total_count:0,open_count:0,in_progress_count:0,resolved_count:0,truncated:false,rows:[]};
beforeEach(()=>{vi.clearAllMocks();const q={select:()=>q,order:()=>q,limit:async()=>({data:[{id:id(1),name:'FICTIONAL CLIENT'}],error:null})};m.from.mockReturnValue(q);m.rpc.mockImplementation(async(name:string)=>({error:null,data:name==='list_monthly_settlements'?[draft]:name==='get_month_close_overview'?overview:name==='get_statement_question_workbench'?questions:[]}));});
const render=(month:string|undefined='2024-01')=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:id(1),...(month?{month}:{})})}).then(renderToStaticMarkup);
it('keeps the month filter and shows combined funding plus the selected draft’s before/after balance',async()=>{
 const html=await render();expect(m.rpc).toHaveBeenCalledWith('get_month_close_overview',{p_org:id(1),p_month:'2024-01-01'});expect(m.rpc).toHaveBeenCalledWith('get_statement_question_workbench',{p_org:id(1),p_month:'2024-01-01'});expect(html).toContain('name="month"');expect(html).toContain('CNY 200.00');expect(html).toContain('本次发布资金预览');expect(html).toContain('CNY 600.00');expect(html).toContain('company='+id(1)+'&amp;month=2024-01');
});
it('does not hide independently reviewed drafts when advisory reads fail or imply unknown funds are zero',async()=>{
 m.rpc.mockImplementation(async(name:string)=>name==='get_month_close_overview'||name==='get_statement_question_workbench'?{data:null,error:{message:'PRIVATE'}}:{data:name==='list_monthly_settlements'?[draft]:[],error:null});const html=await render();expect(html).toContain('正式发布并扣余额 CNY 400.00');expect(html).toContain('资金核算暂不可用');expect(html).toContain('余额预览暂不可用');expect(html).not.toContain('CNY 0.00');expect(html).not.toContain('PRIVATE');
});
it('preserves cross-month recent-record browsing without pretending to aggregate all months together',async()=>{
 const html=await render('');expect(m.rpc.mock.calls.map(c=>c[0])).not.toContain('get_month_close_overview');expect(m.rpc.mock.calls.map(c=>c[0])).not.toContain('get_statement_question_workbench');expect(html).toContain('选择结算月份后');expect(html).toContain('month=2024-01');
});
