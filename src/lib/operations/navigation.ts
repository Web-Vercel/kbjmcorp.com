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
 return names[locale==='zh'?0:1];
}
