import type {OpsContext} from './model';
import {canVisitOperationsPage} from './navigation';
export const workflowGroups=[
 {key:'month',zh:'月结办理',en:'Monthly settlement',pages:[['monthly-automation','自动月结','Automation'],['monthly-manual','手动办理','Manual processing'],['settlements','账单与复核','Statements and review']]},
 {key:'sources',zh:'来源核对',en:'Source checks',pages:[['source-data','同步来源','Synced sources'],['source-checks','完整性核对','Completeness'],['manual-sources','手工报表','Manual reports'],['manual-finance','手工草稿与复核','Manual drafts and review']]},
 {key:'funds',zh:'资金查询',en:'Fund records',pages:[['funds','资金查询','Fund records']]},
 {key:'intercompany',zh:'公司间对账',en:'Intercompany reconciliation',pages:[['upstream-payments','到账与核销','Receipts and allocations'],['upstream','采购账单','Procurement statements']]},
 {key:'questions',zh:'问题中心',en:'Issue center',pages:[['statement-questions','账单问题','Statement questions'],['service-requests','服务与财务咨询','Service and finance queries']]},
] as const;
export function workflowGroup(page:string){return workflowGroups.find(g=>(g.key==='funds'&&page==='fund-summary')||(g.key==='month'&&['month-close','pricing'].includes(page))||g.pages.some(p=>p[0]===page));}
export function workflowPages(group:typeof workflowGroups[number],context:OpsContext|null|undefined){return group.pages.filter(p=>canVisitOperationsPage(context,p[0]));}
export function workflowEntry(group:typeof workflowGroups[number],context:OpsContext|null|undefined){return group.key==='month'?(canVisitOperationsPage(context,'settlements')?'settlements':undefined):workflowPages(group,context)[0]?.[0];}
