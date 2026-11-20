import {operationsMenuLabel} from '@/lib/operations/navigation';
export type PartnerView='overview'|'clients'|'commissions'|'settlements'|'files'|'settings';
export type PartnerNavigationAccess={internal:boolean;owner:boolean;canPrepare:boolean;canReview:boolean};
export function partnerPageTitles(access:PartnerNavigationAccess):Record<PartnerView,string>{
 if(!access.internal)return {overview:'代理业务总览',clients:'客户归属与引荐',commissions:'佣金明细',settlements:'月度结算',files:'合作文件',settings:'代理账号管理'};
 const reviewOnly=!access.owner&&access.canReview&&!access.canPrepare;
 const root=operationsMenuLabel('agents',['代理业务','Agent business'],{...access,roles:[],canSource:false,canSupport:false},'zh');
 return {overview:root,clients:access.owner?'客户归属与引荐':'客户归属依据',commissions:access.owner||access.canPrepare&&access.canReview?'佣金核算与复核':reviewOnly?'佣金复核':'佣金核算',settlements:access.owner?'月度结算管理':access.canPrepare&&access.canReview?'结算制单与复核':reviewOnly?'结算复核':'结算制单',files:'合作文件',settings:'代理账号管理'};
}
