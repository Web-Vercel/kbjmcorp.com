import {expect,it,vi} from 'vitest';
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error(url);},notFound:()=>{throw new Error('NOT_FOUND');}}));
import Page from '@/app/[locale]/operations/fund-summary/page';
it('preserves explicit monthly Beijing bookmarks without retaining private query parameters',async()=>{await expect(Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:'company-id',month:'2026-10',ticket:'private'})})).rejects.toThrow('/zh/operations/funds?company=company-id&month=2026-10&view=monthly&basis=beijing');});
it('opens current funds for existing balance links without a month',async()=>{await expect(Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:'company-id'})})).rejects.toThrow('/zh/operations/funds?company=company-id&view=current');});
