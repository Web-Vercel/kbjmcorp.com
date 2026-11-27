import {beforeEach,expect,it,vi} from 'vitest';
const redirect=vi.hoisted(()=>vi.fn((url:string)=>{throw Error('REDIRECT:'+url);}));
vi.mock('next/navigation',()=>({redirect,notFound:()=>{throw Error('NOT_FOUND')},useRouter:()=>({refresh:vi.fn()})}));
vi.mock('@/components/operations/MonthCloseDetails',()=>({default:vi.fn(async()=> 'DETAILS')}));
import Page from '@/app/[locale]/operations/month-close/page';
beforeEach(()=>{redirect.mockClear();});
it('uses a single billing workbench while retaining company and history month',async()=>{
 await expect(Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:'company-fixture',month:'2026-11'})})).rejects.toThrow('REDIRECT:/zh/operations/settlements?company=company-fixture&month=2026-11');
});
it('retains the explicitly requested detailed workflow without making it the default',async()=>{
 expect(await Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({view:'details'})})).toBe('DETAILS');expect(redirect).not.toHaveBeenCalled();
});
