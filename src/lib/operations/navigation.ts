import type {OpsContext} from './model';
/** Presentation policy matching route guards. Actions still authorize on the server. */
export function canVisitOperationsPage(context:OpsContext|null|undefined,page:string):boolean{
 if(!context)return false;
 if(context.owner)return true;
 const finance=context.canPrepare||context.canReview;
 if(['staff','ads-reporting','upstream'].includes(page))return false;
 if(page==='manual-accounts')return context.canSource;
 if(page==='manual-sources')return context.canSource||finance;
 if(page==='service-requests')return context.canSupport||finance;
 return ['agents','refunds','manual-finance','fund-summary','month-close','source-data','source-checks','pricing','settlements','collections','funds','upstream-payments','statement-questions'].includes(page)&&finance;
}
export function operationsMenuLabel(page:string,names:readonly string[],context:OpsContext|null|undefined,locale:'zh'|'en'){
 if(page==='pricing'&&context&&!context.owner)return locale==='zh'?'报价查看':'View quotes';
 if(context&&!context.owner&&context.canReview&&!context.canPrepare){
  const labels:Record<string,[string,string]>={settlements:['月度结算复核','Settlement review'],collections:['收款到账复核','Receipt review'],agents:['代理佣金与结算复核','Agent commission and settlement review'],refunds:['客户退款复核','Refund review'],'source-checks':['整月活动覆盖复核','Monthly coverage review'],'manual-finance':['手工草稿复核','Manual draft review'],'upstream-payments':['公司间到账复核','Intercompany receipt review']};
  if(labels[page])return labels[page][locale==='zh'?0:1];
 }
 return names[locale==='zh'?0:1];
}
