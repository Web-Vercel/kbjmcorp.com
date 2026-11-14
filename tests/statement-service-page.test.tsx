import {it,expect,vi,beforeEach} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({from:vi.fn(),match:vi.fn(),guard:vi.fn(),header:vi.fn()}));
vi.mock('@/lib/client/page',()=>({requireClientPage:m.guard}));
vi.mock('@/components/SiteHeader',()=>({default:(props:unknown)=>{m.header(props);return null;}}));vi.mock('@/components/SiteFooter',()=>({default:()=>null}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/account/service/page';
import ServiceThread from '@/components/operations/ServiceThread';
const statement='b0000000-0000-4000-8000-000000000001',ticket='b0000000-0000-4000-8000-000000000002',org='b0000000-0000-4000-8000-000000000003';
const row={id:ticket,organization_id:org,category:'billing',subject:'FICTIONAL BILL QUESTION',status:'resolved',created_at:'2024-02-01T00:00:00Z',updated_at:'2024-02-02T00:00:00Z',statement_id:statement,statement_month:'2024-01-01'};
beforeEach(()=>{vi.clearAllMocks();m.guard.mockResolvedValue({client:{from:m.from},user:{id:'client'}});m.from.mockImplementation((table:string)=>{const result={data:table==='memberships'?[{organization_id:org}]:table==='organizations'?[{id:org,name:'FICTIONAL CLIENT'}]:table==='service_requests'?[row]:[],error:null};const q:any={};for(const name of ['select','eq','in','order','limit'])q[name]=()=>q;q.match=(v:unknown)=>{m.match(v);return q;};q.maybeSingle=async()=>({data:row,error:null});q.then=(resolve:any,reject:any)=>Promise.resolve(result).then(resolve,reject);return q;});});
it('filters related requests in the database before the limit and links back to the exact client bill',async()=>{
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({statement,ticket})}));expect(m.match).toHaveBeenCalledWith({statement_id:statement});expect(html).toContain('仅显示本账单相关工单');expect(html).toContain(`statement=${statement}#statement-${statement}`);expect(html).toContain('不会改变原账单');expect(html).not.toContain('提交服务工单');
});
it('keeps staff bill links inside the finance workflow and explains that status is not fee consent',()=>{
 const html=renderToStaticMarkup(<ServiceThread locale="zh" requests={[row]} selected={row} messages={[]} staff/>);expect(html).toContain(`company=${org}&amp;month=2024-01#statement-${statement}`);expect(html).not.toContain('/account/statements');expect(html).toContain('不代表客户认可收费');expect(html).toContain('已处理工单会重新打开');
});

it('retains the request and linked statement in authentication and thread anchors without the public header',async()=>{
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({statement,ticket})}));const path=`/account/service?ticket=${ticket}&statement=${statement}#service-request-${ticket}`;
 expect(m.guard).toHaveBeenCalledWith('zh',`/zh${path}`);expect(m.header).not.toHaveBeenCalled();expect(html).toContain(`id="service-request-${ticket}"`);expect(html).toContain(`ticket=${ticket}&amp;statement=${statement}#service-request-${ticket}`);expect(m.match).toHaveBeenCalledWith({statement_id:statement});
});
