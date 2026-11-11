// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('@/components/admin/AdminForm',()=>({default:({children,button}:{children:React.ReactNode;button:string})=><form>{children}<button>{button}</button></form>}));
import AdsSourceControls from '@/components/operations/AdsSourceControls';
afterEach(cleanup);
const snapshot={id:'c0000000-0000-4000-8000-000000000001',since:'2026-10-25',until:'2026-10-31',check_status:'no_data'};
function client(binding:object|null=null,shared:object[]=[],error=false){return {from:(table:string)=>({select(){return this;},order(){return this;},eq(){return this;},limit:async()=>({data:[{id:'b0000000-0000-4000-8000-000000000001',name:'FICTIONAL COMPANY'}],error:null}),maybeSingle:async()=>({data:binding,error:error?{message:'PRIVATE'}:null}),in:async()=>({data:shared,error:null})})} as unknown as SupabaseClient;}
it('requires an explicit company choice rather than silently mapping the real account to the first test company',async()=>{render(await AdsSourceControls({client:client(),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot]}));const select=screen.getByLabelText('实际获授权的客户企业') as HTMLSelectElement;expect(select.value).toBe('');expect(select.required).toBe(true);expect(screen.getByRole('button',{name:'确认账户归属关联'})).toBeTruthy();expect(screen.queryByRole('button',{name:'交接选定来源版本供财务查看'})).toBeNull();});
it('retains the pending source status and requires selection of one unshared version',async()=>{render(await AdsSourceControls({client:client({id:'binding',organization_id:'b0000000-0000-4000-8000-000000000001',active:true,revision:1}),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot]}));expect((screen.getByLabelText('待交接的来源快照') as HTMLSelectElement).value).toBe('');expect(screen.getByRole('option',{name:/仍有待核对项/})).toBeTruthy();expect(screen.getByText(/人工说明不会把来源变成已批准账单/)).toBeTruthy();});
it('does not offer a new handoff when paused and reports missing schema without private details',async()=>{const view=render(await AdsSourceControls({client:client({id:'binding',active:false,revision:2}),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot]}));expect(screen.queryByRole('button',{name:'交接选定来源版本供财务查看'})).toBeNull();expect(screen.getByText('恢复访问前，不能交接新的来源版本。')).toBeTruthy();view.unmount();render(await AdsSourceControls({client:client(null,[],true),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot]}));expect(screen.getByText(/021数据库更新/)).toBeTruthy();expect(screen.queryByText('PRIVATE')).toBeNull();});
const company='b0000000-0000-4000-8000-000000000001';
const monthly={...snapshot,since:'2026-10-01',until:'2026-10-31'};
const binding={id:'binding',organization_id:company,active:true,revision:1};
it('distinguishes an operational source from a monthly source without implying zero activity',async()=>{
 render(await AdsSourceControls({client:client(binding),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot],expectedCompany:company,month:'2026-10'}));
 expect(screen.getByText(/只投放一两天也可以/)).toBeTruthy();expect(screen.queryByRole('button',{name:'交接选定来源版本供财务查看'})).toBeNull();expect(screen.queryByRole('link',{name:'查看整月活动覆盖核实'})).toBeNull();
});
it('requires explicit handoff of a saved month before offering finance verification',async()=>{
 const view=render(await AdsSourceControls({client:client(binding),locale:'zh',accountId:'adacct_fictional',snapshots:[monthly],expectedCompany:company,month:'2026-10'}));
 expect(screen.getByText(/该月来源已保存，尚未交接/)).toBeTruthy();expect((screen.getByLabelText('待交接的来源快照') as HTMLSelectElement).value).toBe('');expect(screen.queryByRole('link',{name:'查看整月活动覆盖核实'})).toBeNull();view.unmount();
 render(await AdsSourceControls({client:client(binding,[{snapshot_id:monthly.id}]),locale:'zh',accountId:'adacct_fictional',snapshots:[monthly],expectedCompany:company,month:'2026-10'}));
 const link=screen.getByRole('link',{name:'查看整月活动覆盖核实'});expect(link.getAttribute('href')).toBe(`/zh/operations/source-checks?company=${company}&month=2026-10`);expect(screen.getByText(/新读取的版本仍须单独选择交接/)).toBeTruthy();
});
it('blocks handoff and access mutations for a different workbench company',async()=>{
 render(await AdsSourceControls({client:client(binding),locale:'zh',accountId:'adacct_fictional',snapshots:[monthly],expectedCompany:'b0000000-0000-4000-8000-000000000002',month:'2026-10'}));
 expect(screen.getByText(/与月结工作台所选企业不一致/)).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();expect(screen.getByRole('link',{name:'返回月结工作台'}).getAttribute('href')).toContain('company=b0000000-0000-4000-8000-000000000002');
});
it('does not offer a verification shortcut for paused handoffs',async()=>{
 render(await AdsSourceControls({client:client({...binding,active:false},[{snapshot_id:monthly.id}]),locale:'zh',accountId:'adacct_fictional',snapshots:[monthly],expectedCompany:company,month:'2026-10'}));
 expect(screen.queryByRole('link',{name:'查看整月活动覆盖核实'})).toBeNull();
});
it('pins new ownership choices to the explicitly selected workbench company',async()=>{
 render(await AdsSourceControls({client:client(),locale:'zh',accountId:'adacct_fictional',snapshots:[snapshot],expectedCompany:company,month:'2026-10'}));const select=screen.getByLabelText('实际获授权的客户企业') as HTMLSelectElement;expect(select.value).toBe('');expect([...select.options].filter(o=>o.value).map(o=>o.value)).toEqual([company]);
});
