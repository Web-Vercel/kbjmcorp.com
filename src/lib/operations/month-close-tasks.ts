import {closeAction,closeStages,type CloseAccount} from './month-close';
export type MonthCloseTask={bindingId:string;label:string;group:'actionable'|'waiting'|'blocked'|'published';reason:string;href:string};
export function monthCloseTasks(accounts:CloseAccount[],context:{owner:boolean;canPrepare:boolean;canReview:boolean},locale:'zh'|'en',company:string,month:string,fundingAvailable:boolean):MonthCloseTask[]{
 const zh=locale==='zh';
 return accounts.map(a=>{
  const action=closeAction(a,context,locale,company,month);
  let group:MonthCloseTask['group']='waiting';
  let reason:string=closeStages[a.stage]?.[zh?'zh':'en']||(zh?'进度尚待确认':'Progress unconfirmed');
  if(a.stage==='published')group='published';
  else if(!action||a.stage==='month_open'||a.stage==='source_history_needed')group='blocked';
  else if(a.stage==='funding_needed'&&!fundingAvailable){group='blocked';reason=zh?'收款仍处于指定虚构企业模式，请管理员核实正式配置':'Collections are scoped to a fictional company; administrator configuration check needed';}
  else if((a.stage==='coverage_review_needed'&&a.coverage_prepared_by_me)||(a.stage==='settlement_review_needed'&&a.draft_prepared_by_me))reason=zh?'本人已制单，须由另一账号独立复核':'Prepared by this account; another account must independently review';
  else if(action.allowed)group='actionable';
  return {bindingId:a.binding_id,label:a.account_label,group,reason,href:`#month-close-account-${a.binding_id}`};
 });
}
