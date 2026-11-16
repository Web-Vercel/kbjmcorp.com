import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Status from '@/components/admin/AccountReadStatus';
const account={platform:'openai_ads',external_id:'adacct_test',organization_id:'org-test',connection_status:'unverified',source_type:'manual',last_synced_at:null};
it('shows saved API read evidence despite stale manual account markers without claiming a live connection',()=>{
 const html=renderToStaticMarkup(<Status account={account} recent={{created_at:'2026-11-16T18:00:00Z'}} canRead unavailable={false} zh/>);
 expect(html).toContain('平台 API 读取');expect(html).toContain('最近成功读取');expect(html).toContain('非实时连接状态');expect(html).not.toContain('尚未同步');
});
it('uses provenance to distinguish a generated test copy from a platform read',()=>{
 const html=renderToStaticMarkup(<Status account={{...account,external_id:'adacct_acceptance_test'}} recent={{created_at:'2026-11-16T18:00:00Z',provenance:{kind:'acceptance-copy-not-payable',targetOrganizationId:'org-test'}}} canRead unavailable={false} zh/>);
 expect(html).toContain('测试副本 · 不连接平台');expect(html).toContain('副本生成时间');expect(html).not.toContain('平台 API 读取');expect(html).not.toContain('最近成功读取');
});
it('does not trust test provenance belonging to another company',()=>{
 const html=renderToStaticMarkup(<Status account={{...account,external_id:'adacct_acceptance_test'}} recent={{created_at:'2026-11-16T18:00:00Z',provenance:{kind:'acceptance-copy-not-payable',targetOrganizationId:'other-org'}}} canRead unavailable={false} zh/>);
 expect(html).toContain('副本记录待核实');expect(html).not.toContain('副本生成时间');expect(html).not.toContain('平台 API 读取');
});
it('distinguishes failed history reads, restricted access and no recorded success',()=>{
 const failed=renderToStaticMarkup(<Status account={account} canRead unavailable zh/>);expect(failed).toContain('暂无法确认');expect(failed).not.toContain('未查到成功读取记录');
 const restricted=renderToStaticMarkup(<Status account={account} canRead={false} unavailable={false} zh/>);expect(restricted).toContain('仅管理员可见');expect(restricted).not.toContain('未查到成功读取记录');
 const empty=renderToStaticMarkup(<Status account={account} canRead unavailable={false} zh/>);expect(empty).toContain('未查到成功读取记录');expect(empty).not.toContain('尚未同步');
});
