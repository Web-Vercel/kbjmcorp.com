import type {OpsContext} from './model';
/** Presentation policy matching route guards. Actions still authorize on the server. */
export function canVisitOperationsPage(context:OpsContext|null|undefined,page:string):boolean{
 if(!context)return false;
 if(context.owner)return true;
 const finance=context.canPrepare||context.canReview;
 if(page==='monthly-automation')return false;
 if(page==='monthly-manual')return finance;
 if(['staff','ads-reporting','upstream'].includes(page))return false;
 if(page==='manual-accounts')return context.canSource;
 if(page==='manual-sources')return context.canSource||finance;
 if(page==='service-requests')return context.canSupport||finance;
 return ['agents','refunds','manual-finance','fund-summary','month-close','source-data','source-checks','pricing','settlements','collections','funds','upstream-payments','statement-questions'].includes(page)&&finance;
}
export function operationsMenuLabel(page:string,names:readonly string[],context:OpsContext|null|undefined,locale:'zh'|'en'){
 if(page==='pricing'&&context&&!context.owner)return locale==='zh'?'报价查看':'View quotes';
 if(context&&!context.owner&&(context.canPrepare||context.canReview)){
  const shared:Record<string,[string,string]>={'source-data':['广告数据与凭证','Advertising data and evidence'],'manual-sources':['手工提交平台报表','Manual platform report submission']};
  if(page==='service-requests'&&!context.canSupport)return locale==='zh'?'财务咨询工单':'Financial service requests';
  if(shared[page])return shared[page][locale==='zh'?0:1];
  if(context.canPrepare&&context.canReview){const combined:Record<string,[string,string]>={agents:['代理佣金与结算','Agent commissions and settlements'],settlements:['月度结算制单与复核','Settlement preparation and review'],collections:['收款登记与复核','Receipt registration and review'],refunds:['退款核算与复核','Refund assessment and review'],'upstream-payments':['公司间到账登记与复核','Intercompany receipt registration and review']};if(combined[page])return combined[page][locale==='zh'?0:1];}
  if(context.canPrepare&&!context.canReview){
   const labels:Record<string,[string,string]>={settlements:['月度结算制单','Settlement preparation'],collections:['收款到账登记','Receipt registration'],agents:['代理佣金与结算','Agent commissions and settlements'],refunds:['退款核算与登记','Refund assessment and records'],'manual-finance':['手工草稿进度','Manual draft progress'],'upstream-payments':['公司间到账登记','Intercompany receipt registration']};
   if(labels[page])return labels[page][locale==='zh'?0:1];
  }
 }
 if(context&&!context.owner&&context.canReview&&!context.canPrepare){
  const labels:Record<string,[string,string]>={settlements:['月度结算复核','Settlement review'],collections:['收款到账复核','Receipt review'],agents:['代理佣金与结算复核','Agent commission and settlement review'],refunds:['客户退款复核','Refund review'],'source-checks':['月度数据完整性核对','Monthly data completeness checks'],'manual-finance':['手工草稿复核','Manual draft review'],'upstream-payments':['公司间到账复核','Intercompany receipt review']};
  if(labels[page])return labels[page][locale==='zh'?0:1];
 }
 const shared:Record<string,[string,string]>={agents:['代理与佣金管理','Agent and commission management'],refunds:['客户余额退款','Balance refunds'],'manual-accounts':['人工登记广告账户','Register an existing advertising account'],'manual-sources':['手工提交平台报表','Manual platform report submission'],'manual-finance':['手工核对草稿','Manual reconciliation drafts'],'fund-summary':['入账资金摘要','Posted fund summary'],'service-requests':['服务工单','Service requests'],staff:['人员职责','Staff responsibilities'],'month-close':['月结工作台','Month close'],'ads-reporting':['平台数据同步','Platform data sync'],'source-data':['广告数据与凭证','Advertising data and evidence'],'source-checks':['月度数据完整性核对','Monthly data completeness checks'],pricing:['报价管理','Pricing'],settlements:['月度结算管理','Monthly settlement management'],collections:['对公收款与入账','Bank collections and posting'],funds:['资金查询','Fund records'],upstream:['公司间采购对账','Intercompany procurement'],'upstream-payments':['公司间到账核对','Intercompany receipts'],'statement-questions':['账单问题跟进','Billing questions']};
 return (shared[page]||names)[locale==='zh'?0:1];
}
