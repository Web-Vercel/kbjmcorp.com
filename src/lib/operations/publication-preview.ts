import {z} from 'zod';
import {monthFunding} from './month-funding';
const minor=z.string().regex(/^(0|[1-9]\d{0,29})$/);
const overview=z.object({balance_minor:z.string().regex(/^-?(0|[1-9]\d{0,29})$/),accounts:z.array(z.object({draft_id:z.uuid().nullable(),draft_total_cny_minor:minor.nullable(),stage:z.string()})).max(1000)});
export type PublicationPreview={wallet_open:boolean;balance_minor:string|null;charge_minor:string;remaining_minor:string|null};
export function publicationPreview(input:unknown,scope:{organizationId:string;month:string;draftId:string;amountMinor:string}):PublicationPreview|null{
 const funding=monthFunding(input,{organizationId:scope.organizationId,month:scope.month}),parsed=overview.safeParse(input);
 if(!funding||!parsed.success||!minor.safeParse(scope.amountMinor).success)return null;
 const draft=parsed.data.accounts.find(a=>a.draft_id===scope.draftId);
 if(!draft||!['publication_ready','funding_needed','wallet_needed'].includes(draft.stage)||draft.draft_total_cny_minor!==scope.amountMinor)return null;
 return {wallet_open:funding.wallet_id!==null,balance_minor:funding.wallet_id?parsed.data.balance_minor:null,charge_minor:scope.amountMinor,remaining_minor:funding.wallet_id?(BigInt(parsed.data.balance_minor)-BigInt(scope.amountMinor)).toString():null};
}
