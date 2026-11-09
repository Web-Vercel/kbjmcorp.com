export const closeStages={
 access_paused:{step:0,who:'owner',zh:'账户交接访问已暂停',en:'Account source access paused',target:'ads-reporting'},
 account_metadata_needed:{step:0,who:'owner',zh:'需要读取账户信息',en:'Account metadata needed',target:'ads-reporting'},
 month_open:{step:0,who:'none',zh:'该账户时区的月份尚未结束',en:'Month is still open in account timezone',target:'ads-reporting'},
 source_needed:{step:1,who:'owner',zh:'尚未读取该月完整来源',en:'Monthly source not collected',target:'ads-reporting'},
 source_history_needed:{step:1,who:'owner',zh:'超出 API 保留期，需核查已归档来源',en:'Outside API retention; check archived sources',target:'source-data'},
 handoff_needed:{step:1,who:'owner',zh:'整月来源已读取，尚未交接',en:'Monthly source collected, handoff pending',target:'ads-reporting'},
 source_invalid:{step:2,who:'owner',zh:'来源存在差异或格式问题，需重新核对',en:'Source discrepancy or format issue needs investigation',target:'ads-reporting'},
 coverage_needed:{step:2,who:'prepare',zh:'需要核实整月活动覆盖',en:'Monthly activity evidence needed',target:'source-checks'},
 coverage_review_needed:{step:2,who:'review',zh:'整月活动依据待独立复核',en:'Activity evidence awaits independent review',target:'source-checks'},
 quote_needed:{step:3,who:'owner',zh:'尚无广告成本匹配的可用报价',en:'No available quote matches the source cost',target:'pricing'},
 preparation_needed:{step:4,who:'prepare',zh:'来源及报价已具备，等待结算制单',en:'Source and quote available; prepare settlement',target:'settlements'},
 quote_archived:{step:3,who:'owner',zh:'草稿引用的报价已归档',en:'Draft quote has been archived',target:'pricing'},
 settlement_rejected:{step:3,who:'owner',zh:'结算已退回，需修订报价后重新制单',en:'Settlement rejected; revise quote and prepare again',target:'pricing'},
 settlement_review_needed:{step:5,who:'review',zh:'结算草稿待独立复核',en:'Settlement draft awaits independent review',target:'settlements'},
 wallet_needed:{step:6,who:'owner',zh:'尚未开立人民币资金账户',en:'CNY wallet required',target:'wallet'},
 funding_needed:{step:6,who:'finance',zh:'已入账余额不足，需先核实到账',en:'Insufficient posted funds; verify incoming payment',target:'collections'},
 publication_ready:{step:6,who:'owner',zh:'复核已通过，等待管理员正式发布',en:'Reviewed; administrator publication pending',target:'settlements'},
 published:{step:7,who:'view',zh:'账单已发布，余额记账已完成',en:'Statement published and ledger posted',target:'settlements'},
} as const;
export type CloseStage=keyof typeof closeStages;
export type CloseAccount={binding_id:string;account_id:string;account_label:string;active:boolean;timezone:string|null;stage:CloseStage;source_id:string|null;source_ready:boolean;coverage_reason:string|null;coverage_kind:string|null;source_cad_minor:string|null;operational_source_count:number;quote_match_count:number;coverage_prepared_by_me:boolean;draft_id:string|null;draft_prepared_by_me:boolean;draft_total_cny_minor:string|null;newer_shared_source:boolean;statement_id:string|null;published_at:string|null;posted_total_cny_minor:string|null};
export type CloseOverview={organization_id:string;month:string;accounts:CloseAccount[];wallet_id:string|null;balance_minor:string;pending_receipt_count:number;pending_receipt_minor:string};
export function closeAction(account:CloseAccount,context:{owner:boolean;canPrepare:boolean;canReview:boolean},locale:string,company:string,month:string){
 const state=closeStages[account.stage];if(!state)return null;
 let allowed: boolean=state.who==='view'||context.owner||(state.who==='prepare'&&context.canPrepare)||(state.who==='review'&&context.canReview)||(state.who==='finance'&&(context.canPrepare||context.canReview));
 if(state.who==='none')allowed=false;
 if(account.stage==='coverage_review_needed'&&account.coverage_prepared_by_me)allowed=false;
 if(account.stage==='settlement_review_needed'&&account.draft_prepared_by_me)allowed=false;
 const params=new URLSearchParams({company,month});
 if(state.target==='ads-reporting')params.set('account',account.account_id);
 if(state.target==='pricing')params.set('binding',account.binding_id);
 const path=state.target==='wallet'?`/${locale}/admin/crm/${company}`:`/${locale}/operations/${state.target}`;
 return {allowed,href:path+(state.target==='wallet'?'':'?'+params.toString()),who:state.who};
}
