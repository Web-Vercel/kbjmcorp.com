import {z} from 'zod';
import {monthCloseOverview} from './month-close-overview';
import type {CloseAccount} from './month-close';
const month=z.iso.date().refine(m=>m.endsWith('-01')).nullable();
const schema=z.object({organization_id:z.uuid(),accounts:z.array(z.object({binding_id:z.uuid(),account_id:z.string(),account_label:z.string(),active:z.boolean(),first_month:month,automatic:z.boolean(),timezone:z.string().nullable(),current_month:month,last_published_month:month,next_month:month,gap:z.boolean(),task_month:month,flow:z.unknown().nullable(),job:z.object({month:z.iso.date(),state:z.enum(['pending','running','retry','failed','prepared','cancelled'])}).nullable()}))});
export function accountBillingOverview(input:unknown,company:string){const parsed=schema.safeParse(input);if(!parsed.success||parsed.data.organization_id!==company)return null;const data=parsed.data;
 const accounts=[];
 for(const a of data.accounts){
  let flow:CloseAccount|null=null;
  if(a.flow!==null){if(!a.task_month)return null;const checked=monthCloseOverview({organization_id:company,month:a.task_month,accounts:[a.flow],wallet_id:null,balance_minor:'0',pending_receipt_count:0,pending_receipt_minor:'0'},{organizationId:company,month:a.task_month});if(!checked||checked.accounts[0].binding_id!==a.binding_id||checked.accounts[0].account_id!==a.account_id)return null;flow=checked.accounts[0];}
  if(a.next_month&&(!a.first_month||!a.current_month||a.next_month<a.first_month||a.next_month>=a.current_month))return null;
  accounts.push({...a,flow});
 }
 return {...data,accounts};}
export type AccountBilling=NonNullable<ReturnType<typeof accountBillingOverview>>;
