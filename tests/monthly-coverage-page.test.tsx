import {it,expect,vi,beforeEach} from 'vitest';import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({operations:vi.fn(),status:'pending',self:false,error:false}));vi.mock('@/lib/operations/server',()=>({requireOperations:m.operations}));
import Page from '@/app/[locale]/operations/source-checks/page';
const org='b0000000-0000-4000-8000-000000000001',source='c0000000-0000-4000-8000-000000000001',check='d0000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.clearAllMocks();m.status='pending';m.self=false;m.error=false;const q={select:()=>q,order:()=>q,limit:async()=>({data:[{id:org,name:'FICTIONAL COMPANY'}],error:null})};m.operations.mockResolvedValue({context:{owner:false,canReview:true,canPrepare:false},user:{id:'reviewer'},client:{from:()=>q,rpc:async(name:string)=>({error:m.error?{message:'PRIVATE ERROR'}:null,data:name==='list_ads_source_handoffs'?[{snapshot_id:source,account_name:'FICTIONAL ACCOUNT',since:'2026-10-01',until:'2026-10-31',currency:'CAD',settlement_ready:false,coverage_valid:false}]:[{id:check,snapshot_id:source,account_name:'FICTIONAL ACCOUNT',currency:'CAD',since:'2026-10-01',until:'2026-10-31',timezone:'America/Vancouver',impressions:'0',clicks:'0',amount_micros:'0',kind:'zero',evidence_reference:'FICTIONAL REFERENCE',evidence_sha256:'a'.repeat(64),active_from:null,note:'FICTIONAL NOTE',prepared_by:m.self?'reviewer':'preparer',status:m.status,review_note:null}]})}});});
const render=()=>Page({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({company:org,month:'2026-10'})}).then(renderToStaticMarkup);
it('anchors original evidence and source versions and offers review only on the original check',async()=>{
 const html=await render();expect(html).toContain(`id="coverage-check-${check}"`);expect(html).toContain(`id="coverage-source-${source}"`);expect(html).toContain(`name="checkId" value="${check}"`);expect(html).toContain('保存整月覆盖复核结果');
});
it('does not offer self-review or another review on completed evidence',async()=>{
 m.self=true;let html=await render();expect(html).toContain('另一位有权限的人员复核');expect(html).not.toContain('保存整月覆盖复核结果');m.self=false;m.status='approved';html=await render();expect(html).toContain('已通过独立复核');expect(html).not.toContain('保存整月覆盖复核结果');
});
it('does not show mutation controls or private errors when source/evidence reads fail',async()=>{
 m.error=true;const html=await render();expect(html).toContain('核实记录暂不可用');expect(html).not.toContain('保存整月覆盖复核结果');expect(html).not.toContain('PRIVATE ERROR');
});
