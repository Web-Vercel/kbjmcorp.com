import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {workspaceGroups} from '@/lib/operations/workspace-navigation';
import type {OpsContext} from '@/lib/operations/model';
const state=vi.hoisted(()=>({path:'/zh/operations/collections'}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path}));
vi.mock('@/components/SignOutButton',()=>({default:()=>null}));
import Shell from '@/components/admin/AdminShell';
import styles from '@/components/workspace/InternalWorkspace.module.css';
const owner:OpsContext={owner:true,roles:[],canSource:true,canPrepare:true,canReview:true,canSupport:true};
const finance:OpsContext={...owner,owner:false,canSource:false,canSupport:false,canReview:false};
it('places every operational task once under a named business group',()=>{
 const groups=workspaceGroups('zh',owner,true,true);const paths=groups.flatMap(g=>g.items.map(i=>i.path));
 expect(new Set(paths).size).toBe(paths.length);expect(paths.filter(p=>p.startsWith('operations/'))).toHaveLength(19);
 expect(groups.find(g=>g.key==='finance')?.items.some(i=>i.path==='operations/collections')).toBe(true);
 expect(groups.map(g=>g.label)).toEqual(['客户与业务','广告运营','财务与结算','代理与佣金','账号与权限']);
});
it.each([false,true])('keeps finance-only staff within their duties (reviewer=%s)',reviewer=>{
 const groups=workspaceGroups('zh',{...finance,canPrepare:!reviewer,canReview:reviewer},false,false);const items=groups.flatMap(g=>g.items);
 expect(items).toHaveLength(15);expect(items.some(i=>i.path.startsWith('admin/'))).toBe(false);
 for(const key of ['staff','ads-reporting','upstream','manual-accounts'])expect(items.some(i=>i.path===`operations/${key}`)).toBe(false);
 expect(items.find(i=>i.path==='operations/collections')?.label).toBe(reviewer?'收款到账复核':'收款到账登记');
});
it('fails closed for missing operations context and does not imply account administration from CRM access',()=>{
 expect(workspaceGroups('en',null,false,false)).toEqual([]);
 const items=workspaceGroups('en',null,true,false).flatMap(g=>g.items);
 expect(items.map(i=>i.path)).toEqual(['admin/inquiries','admin/crm','admin/applications','admin/projects','admin/accounts']);
});
it('uses one shell and grouped breadcrumb for operations and management pages without a second center switch',async()=>{
 const html=renderToStaticMarkup(<Shell locale="zh" staffRole="admin" operationsContext={owner} canManage operations identity={<p>测试员工</p>}><main><h1>对公收款与入账</h1></main></Shell>);
 expect(html).toContain('业务管理中心');expect(html).toContain('财务与结算');expect(html).not.toContain('三方运营中心');expect(html.match(/href="\/zh\/operations\/collections"/g)).toHaveLength(1);expect(html.match(/<main[ >]/g)).toHaveLength(1);
 expect(html).toContain('aria-current="page">对公收款与入账');expect(html).toContain('<details open=""><summary>财务与结算');
 if(process.env.WORKSPACE_CAPTURE){
  const {readFile,writeFile,mkdir}=await import('node:fs/promises');let css=await readFile('src/components/workspace/InternalWorkspace.module.css','utf8');
  for(const [key,value] of [['shell',styles.shell],['navigation',styles.navigation],['operations',styles.operations],['mobileToggle',styles.mobileToggle]])css=css.replaceAll(`.${key}`,`.${value}`);
  css=css.replaceAll(/:global\(([^)]+)\)/g,'$1');
  const plate=html.match(/class="(_plate_[^"]+)"/)?.[1]||'plate';
  css+='\n'+(await readFile('src/components/admin/AdminBrandMark.module.css','utf8')).replaceAll('.plate',`.${plate}`).replaceAll(/:global\(([^)]+)\)/g,'$1');
  css+='\n'+(await readFile('src/components/WorkspacePresentation.module.css','utf8')).replaceAll('.workspace','._captureWorkspace').replaceAll(/:global\(([^)]+)\)/g,'$1');
  await mkdir('/workspace/shared/unified-workspace',{recursive:true});
  await writeFile('/workspace/shared/unified-workspace/admin.html',`<!doctype html><html lang="zh"><meta charset="utf-8"><style>${await readFile('src/app/globals.css','utf8')}\n${css}</style><body><div class="_captureWorkspace">${html}</div></body></html>`);
 }
});
it('uses the same menu groups on a CRM page and preserves the current route in language switching',()=>{
 state.path='/zh/admin/crm';const html=renderToStaticMarkup(<Shell locale="zh" staffRole="admin" operationsContext={owner} canManage><h1>CRM</h1></Shell>);
 expect(html).toContain('href="/en/admin/crm"');expect(html).toContain('客户与业务');expect(html).toContain('href="/zh/operations/collections"');state.path='/zh/operations/collections';
});
