// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({operations:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
vi.mock('@/components/admin/AdminForm',()=>({default:()=>null}));
vi.mock('@/components/operations/AgencyQuoteCalculator',()=>({default:()=>null}));
import Page from '@/app/[locale]/operations/pricing/page';
const company='b0000000-0000-4000-8000-000000000001',quote='d0000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:[{id:quote,organization_id:company,period:'2026-10-01',revision:1,status:'draft',state_revision:1,parent_id:null,total_cny_minor:'60500'}],error:null});
 m.operations.mockResolvedValue({context:{owner:true},client:{rpc:m.rpc,from:(table:string)=>{const chain={select:()=>chain,order:()=>chain,eq:()=>chain,limit:async()=>({data:table==='organizations'?[{id:company,name:'FICTIONAL COMPANY'}]:[],error:null}),in:async()=>({data:[],error:null})};return chain;}}});
});
async function render(locale='zh',month?:string){const doc=document.implementation.createHTMLDocument('');doc.body.innerHTML=renderToStaticMarkup(await Page({params:Promise.resolve({locale}),searchParams:Promise.resolve({company,month})}));return doc;}
it('keeps the same company and month in forward and return links in both languages',async()=>{
 for(const locale of ['zh','en']){const doc=await render(locale,'2026-10');const links=[...doc.querySelectorAll('nav a')].map(a=>a.getAttribute('href'));expect(links).toContain(`/${locale}/operations/month-close?company=${company}&month=2026-10`);expect(links).toContain(`/${locale}/operations/settlements?company=${company}&month=2026-10`);expect(m.rpc).toHaveBeenCalledWith('list_agency_quotes',{p_org:company,p_include_archived:false,p_month:'2026-10-01'});expect(doc.querySelector('input[name=month]')?.getAttribute('value')).toBe('2026-10');}
});
it('edits a version in its own month and drops account binding when changing company filters',async()=>{
 const doc=await render();const edit=[...doc.querySelectorAll('a')].find(a=>a.getAttribute('href')?.includes('edit='));const url=new URL(edit!.getAttribute('href')!,'https://example.test');expect(url.searchParams.get('month')).toBe('2026-10');expect(url.searchParams.get('company')).toBe(company);expect(url.hash).toBe('#quote-editor');expect(doc.querySelector('form.admin-filter [name=binding]')).toBeNull();expect(m.rpc).toHaveBeenCalledWith('list_agency_quotes',{p_org:company,p_include_archived:false});
});
it('rejects malformed months before making quote queries',async()=>{
 await expect(render('zh','2026-13')).rejects.toThrow();expect(m.rpc).not.toHaveBeenCalled();
});
