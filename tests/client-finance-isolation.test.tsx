// @vitest-environment jsdom
import React from 'react';
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),scope:vi.fn(),from:vi.fn(),query:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/client/page',()=>({requireClientPage:mocks.session}));
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('not-found');}}));
vi.mock('@/components/SiteHeader',()=>({default:()=>null}));
vi.mock('@/components/SiteFooter',()=>({default:()=>null}));
vi.mock('@/components/crm/ContractDocument',()=>({default:()=> <p>Authorized contract content</p>}));
vi.mock('@/components/billing/ReportDocument',()=>({default:()=> <p>Authorized report content</p>}));
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import {demoReport,demoLines} from '@/lib/billing/demo';
import Report from '@/app/[locale]/account/reports/[id]/page';
import Contract from '@/app/[locale]/account/contracts/[id]/page';
import Company from '@/app/[locale]/account/company/page';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let filters:{table:string;method:string;args:unknown[]}[];
beforeEach(()=>{vi.resetAllMocks();filters=[];mocks.scope.mockResolvedValue({data:[],error:null});mocks.query.mockResolvedValue({data:null,error:null});mocks.rpc.mockResolvedValue({data:[],error:null});
 mocks.from.mockImplementation((table:string)=>{const chain:Record<string,unknown>={};for(const method of ['select','eq','in','not','neq','order'])chain[method]=(...args:unknown[])=>{filters.push({table,method,args});if(table==='finance_access'&&method==='eq')return mocks.scope();return chain;};chain.maybeSingle=mocks.query;chain.limit=mocks.query;return chain;});
 mocks.session.mockResolvedValue({user:{id:'verified-current-user'},client:{from:mocks.from,rpc:mocks.rpc}});
});
afterEach(cleanup);
it.each([['report',Report],['contract',Contract]] as const)('blocks %s guessed IDs before document queries when there is no personal finance grant',async(_name,Page)=>{
 await expect(Page({params:Promise.resolve({locale:'zh',id})})).rejects.toThrow('not-found');expect(filters).toContainEqual({table:'finance_access',method:'eq',args:['user_id','verified-current-user']});expect(mocks.query).not.toHaveBeenCalled();
});
it('limits a report URL to personal finance companies and published reports even for a broad employee RLS session',async()=>{
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});await expect(Report({params:Promise.resolve({locale:'zh',id})})).rejects.toThrow('not-found');
 expect(filters).toContainEqual({table:'monthly_ad_reports',method:'in',args:['organization_id',['company-A']]});expect(filters).toContainEqual({table:'monthly_ad_reports',method:'not',args:['published_at','is',null]});
});
it('limits contract detail to personal companies, released documents and non-draft status',async()=>{
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});await expect(Contract({params:Promise.resolve({locale:'zh',id})})).rejects.toThrow('not-found');
 expect(filters).toContainEqual({table:'client_contracts',method:'in',args:['organization_id',['company-A']]});expect(filters).toContainEqual({table:'client_contracts',method:'eq',args:['client_visible',true]});expect(filters).toContainEqual({table:'client_contracts',method:'neq',args:['status','draft']});
});
it('does not query the contract list without a personal finance grant',async()=>{render(await Company({params:Promise.resolve({locale:'zh'})}));expect(screen.getByText(/暂无已开放的合作登记/)).toBeTruthy();expect(mocks.from).not.toHaveBeenCalledWith('client_contracts');});
it('filters contract lists by personal finance scope instead of employee-wide access',async()=>{
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});mocks.query.mockResolvedValue({data:[],error:null});render(await Company({params:Promise.resolve({locale:'zh'})}));expect(filters).toContainEqual({table:'client_contracts',method:'in',args:['organization_id',['company-A']]});
});
it('shows a retry state rather than treating a failed scope lookup as granted access or a missing document',async()=>{
 mocks.scope.mockResolvedValue({data:null,error:{code:'unavailable'}});render(await Report({params:Promise.resolve({locale:'zh',id})}));expect(screen.getByText('暂时无法读取完整月报，请联系业务人员核实。')).toBeTruthy();expect(mocks.query).not.toHaveBeenCalled();
});

it('allows a personally authorized published report to render',async()=>{
 mocks.rpc.mockResolvedValue({data:true,error:null});
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});mocks.query.mockResolvedValueOnce({data:{...demoReport,organization_id:'company-A'},error:null}).mockResolvedValueOnce({data:demoLines,error:null}).mockResolvedValueOnce({data:{name:'Company A'},error:null});render(await Report({params:Promise.resolve({locale:'zh',id})}));expect(screen.getByText('Authorized report content')).toBeTruthy();
});
it('allows a personally authorized released contract to render',async()=>{
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});mocks.query.mockResolvedValue({data:{id,organization_id:'company-A'},error:null});render(await Contract({params:Promise.resolve({locale:'zh',id})}));expect(screen.getByText('Authorized contract content')).toBeTruthy();
});
it('shows only service registration metadata without a full-contract link',async()=>{
 mocks.scope.mockResolvedValue({data:[{organization_id:'company-A'}],error:null});
 mocks.query.mockResolvedValue({data:[{id,organization_id:'company-A',title:'Service register A',status:'sent',starts_on:'2026-01-01',ends_on:'2026-12-31'}],error:null});
 render(await Company({params:Promise.resolve({locale:'zh'})}));
 expect(screen.getByText('Service register A')).toBeTruthy();
 expect(document.querySelector(`a[href*="/account/contracts/"]`)).toBeNull();
 expect(filters).toContainEqual({table:'client_contracts',method:'select',args:['id,organization_id,title,status,starts_on,ends_on']});
});
