import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {workspaceGroups} from '@/lib/operations/workspace-navigation';
import {workflowGroups,workflowPages} from '@/lib/operations/workflow-groups';
const m=vi.hoisted(()=>({path:'/zh/operations/settlements',query:'company=company-id&month=2026-09&ticket=private-ticket&edit=private-quote'}));
vi.mock('next/navigation',()=>({usePathname:()=>m.path,useSearchParams:()=>new URLSearchParams(m.query)}));
import Tabs from '@/components/operations/WorkflowNavigation';
import Navigation from '@/components/workspace/InternalNavigation';
const context={owner:false,roles:[],canPrepare:true,canReview:false,canSource:false,canSupport:false};
it('keeps allowed details accessible in compact groups without broadening scope',()=>{for(const c of [context,{...context,canPrepare:false,canReview:true}]){const groups=workspaceGroups('zh',c,false,false);expect(groups.flatMap(g=>g.items)).toHaveLength(8);expect(workflowGroups.flatMap(g=>workflowPages(g,c).map(p=>p[0]))).toContain('manual-finance');expect(workflowGroups.flatMap(g=>workflowPages(g,c).map(p=>p[0]))).not.toContain('upstream');}});
it('retains company and month but never carries ticket, quote edit or credentials between tabs',()=>{const html=renderToStaticMarkup(<Tabs locale="zh" context={context}/>);expect(html).toContain('monthly-manual?company=company-id&amp;month=2026-09');expect(html).toMatch(/aria-current="page"[^>]*>账单与复核/);expect(html).not.toContain('private-ticket');expect(html).not.toContain('private-quote');});
it('highlights unified sidebar entry on an existing detail route',()=>{const html=renderToStaticMarkup(<Navigation locale="zh" context={context} canManage={false} admin={false}/>);expect(html).toMatch(/aria-current="page"[^>]*>月结办理/);expect(html).toContain('href="/zh/operations/settlements"');});
it('keeps source-only employees out of financial completeness and draft tabs',()=>{m.path='/en/operations/manual-sources';const html=renderToStaticMarkup(<Tabs locale="en" context={{...context,canPrepare:false,canSource:true}}/>);expect(html).toContain('/en/operations/manual-sources');expect(html).not.toContain('/operations/manual-finance');expect(html).not.toContain('/operations/source-checks');m.path='/zh/operations/settlements';});
it('offers the three approved tabs to administrators without carrying mutation parameters',()=>{m.path='/zh/operations/monthly-automation';const html=renderToStaticMarkup(<Tabs locale="zh" context={{...context,owner:true}}/>);for(const label of ['自动月结','手动办理','账单与复核'])expect(html).toContain(label);expect(html).not.toContain('private-quote');m.path='/zh/operations/settlements';});

it('opens the billing workbench from the monthly sidebar for administrators too',()=>{const groups=workspaceGroups('zh',{...context,owner:true},true,true);expect(groups.flatMap(g=>g.items).find(i=>i.label==='月结办理')?.path).toBe('operations/settlements');});
