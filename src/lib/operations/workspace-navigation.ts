import {workflowGroup,workflowEntry} from './workflow-groups';
import type {OpsContext} from './model';
import {canVisitOperationsPage,operationsMenuLabel} from './navigation';
export type WorkspaceItem={path:string;label:string};
export type WorkspaceGroup={key:string;label:string;items:WorkspaceItem[]};
export function workspaceGroups(locale:'zh'|'en',context:OpsContext|null|undefined,canManage:boolean,admin:boolean):WorkspaceGroup[]{
 const zh=locale==='zh';
 const item=(path:string,cn:string,en:string):WorkspaceItem=>({path,label:path.startsWith('operations/')?operationsMenuLabel(path.slice(11),[cn,en],context,locale):zh?cn:en});
 const ops=(key:string,cn:string,en:string)=>canVisitOperationsPage(context,key)?[item(`operations/${key}`,cn,en)]:[];
 const manage=(key:string,cn:string,en:string)=>canManage?[item(`admin/${key}`,cn,en)]:[];
 const groups:WorkspaceGroup[]= [
  {key:'clients',label:zh?'客户与业务':'Clients and business',items:[...manage('inquiries','咨询线索','Inquiry leads'),...manage('crm','企业客户 CRM','Client CRM'),...manage('applications','企业申请审核','Business applications'),...manage('projects','广告项目','Advertising projects'),...ops('service-requests','服务工单','Service requests')]},
  {key:'advertising',label:zh?'广告运营':'Advertising operations',items:[...manage('accounts','广告账户管理','Advertising account management'),...ops('ads-reporting','平台数据同步','Platform data sync'),...ops('manual-accounts','手工账户归属关联','Manual account ownership links'),...ops('source-data','广告数据与凭证','Advertising data and evidence'),...ops('manual-sources','手工提交平台报表','Manual platform report submission'),...ops('source-checks','月度数据完整性核对','Monthly data completeness checks')]},
  {key:'finance',label:zh?'财务与结算':'Finance and settlement',items:[...ops('month-close','月结工作台','Month close'),...ops('pricing','报价管理','Pricing'),...ops('settlements','月度结算管理','Monthly settlements'),...ops('collections','对公收款与入账','Bank collections and posting'),...ops('fund-summary','入账资金摘要','Posted fund summary'),...ops('funds','客户资金对账','Client funds'),...ops('manual-finance','手工核对草稿','Manual drafts'),...ops('refunds','客户余额退款','Balance refunds'),...ops('upstream','公司间采购对账','Intercompany procurement'),...ops('upstream-payments','公司间到账核对','Intercompany receipts'),...ops('statement-questions','账单问题跟进','Billing questions')]},
  {key:'agents',label:zh?'代理与佣金':'Agents and commissions',items:ops('agents','代理与佣金管理','Agent and commission management')},
  {key:'access',label:zh?'账号与权限':'Accounts and permissions',items:[...(admin&&canManage?[item('admin/role-accounts','业务账号权限','Business account access')]:[]),...ops('staff','人员职责','Staff responsibilities'),...(admin&&canManage?[item('admin/clients','项目协作权限','Project collaboration access')]:[])]},
 ].filter(group=>group.items.length);
 const seen=new Set<string>();
 return groups.map(group=>({...group,items:group.items.flatMap(entry=>{if(!entry.path.startsWith('operations/'))return [entry];const workflow=workflowGroup(entry.path.slice(11));if(!workflow)return [entry];if(seen.has(workflow.key))return [];seen.add(workflow.key);const primary=workflowEntry(workflow,context);return primary?[{path:'operations/'+primary,label:workflow[locale]}]:[];})})).filter(group=>group.items.length);
}
