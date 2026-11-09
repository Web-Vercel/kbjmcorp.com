import {beforeEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn()}),notFound:()=>{throw new Error('Not found');}}));
const m=vi.hoisted(()=>({operations:vi.fn()}));
vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
import Page from '@/app/[locale]/operations/settlements/page';
const org='b0000000-0000-4000-8000-000000000001';
const draft={id:'draft-example',month:'2024-01-01',snapshot_id:'source-example',quote_id:'quote-example',quote_revision:1,source_cad_minor:'10000',total_cny_minor:'50000',agreement_reference:'Verified agreement',note:'Preparation note',prepared_by:'preparer',status:'approved',review_note:'Reviewed',quote_archived:false};
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
