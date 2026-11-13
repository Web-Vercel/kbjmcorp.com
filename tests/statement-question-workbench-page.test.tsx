import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {statementQuestionWorkbench} from '@/lib/operations/statement-questions';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),eq:vi.fn(),context:{owner:false,canPrepare:false,canReview:true}}));
vi.mock('@/lib/operations/server',()=>({requireOperations:async()=>({client:{rpc:m.rpc,from:m.from},context:m.context})}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/operations/statement-questions/page';
const org='b0000000-0000-4000-8000-000000000001',statement='b0000000-0000-4000-8000-000000000002',ticket='b0000000-0000-4000-8000-000000000003';
const row={id:ticket,organization_id:org,category:'billing',subject:'FICTIONAL QUESTION',status:'open',created_at:'2024-02-01T00:00:00Z',updated_at:'2024-02-02T00:00:00Z',statement_id:statement,statement_month:'2024-01-01'};
const report={organization_id:org,month:'2024-01-01',total_count:1,open_count:1,in_progress_count:0,resolved_count:0,truncated:false,rows:[row]};
const render=(selected=true)=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2024-01',...(selected?{ticket}:{})})}).then(renderToStaticMarkup);
beforeEach(()=>{vi.clearAllMocks();m.context.canReview=true;m.rpc.mockResolvedValue({data:report,error:null});m.from.mockImplementation((table:string)=>{const q:any={};q.select=()=>q;q.eq=(...v:unknown[])=>{m.eq(...v);return q;};q.not=()=>q;q.order=()=>q;q.limit=async()=>({data:table==='organizations'?[{id:org,name:'FICTIONAL CLIENT'}]:[],error:null});q.maybeSingle=async()=>({data:row,error:null});return q;});});
it('keeps company and month when opening a ticket and queries exact scoped history independently of list limits',async()=>{
 const html=await render();expect(m.rpc).toHaveBeenCalledWith('get_statement_question_workbench',{p_org:org,p_month:'2024-01-01'});expect(m.eq).toHaveBeenCalledWith('organization_id',org);expect(m.eq).toHaveBeenCalledWith('statement_month','2024-01-01');expect(html).toContain(`company=${org}&amp;month=2024-01&amp;ticket=${ticket}`);expect(html).toContain('发送回复');expect(html).toContain('客户已读账单与工单处理分别记录');
});
it('shows unknown question counts rather than an empty success after a failed lookup',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:'PRIVATE'}});const html=await render(false);expect(html).toContain('账单问题状态暂不可用');expect(html).not.toContain('本月暂未发现');expect(html).not.toContain('发送回复');expect(html).not.toContain('PRIVATE');
});
it('blocks nonfinance staff before looking up organizations and questions',async()=>{m.context.canReview=false;await expect(render()).rejects.toThrow('NOT_FOUND');expect(m.from).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();});
it('rejects mixed scopes or inconsistent full counts and strips private fields from valid rows',()=>{
 expect(statementQuestionWorkbench.safeParse({...report,total_count:2}).success).toBe(false);expect(statementQuestionWorkbench.safeParse({...report,rows:[{...row,statement_month:'2024-02-01'}]}).success).toBe(false);const clean=statementQuestionWorkbench.parse({...report,private_snapshot:'PRIVATE',rows:[{...row,statement_input_sha256:'PRIVATE',body:'PRIVATE'}]});expect(JSON.stringify(clean)).not.toContain('PRIVATE');
});

it('does not show a detail response belonging to a different ticket',async()=>{
 const normal=m.from.getMockImplementation()!;m.from.mockImplementation((table:string)=>{const q=normal(table);if(table==='service_requests')q.maybeSingle=async()=>({data:{...row,id:statement},error:null});return q;});const html=await render();expect(html).toContain('暂时无法读取完整工单');expect(html).not.toContain('发送回复');
});
