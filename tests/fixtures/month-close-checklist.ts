import {buildMonthCloseChecklist} from '@/lib/operations/month-close-checklist';
export const org='b0000000-0000-4000-8000-000000000001',bill='b0000000-0000-4000-8000-000000000002',binding='b0000000-0000-4000-8000-000000000003';
export function checklistInput(){return {organizationId:org,organizationName:'=FICTIONAL COMPANY()',month:'2024-01-01',generatedAt:'2024-02-02T12:00:00Z',
 overview:{organization_id:org,month:'2024-01-01',wallet_id:org,balance_minor:'9007199254740993',pending_receipt_count:0,pending_receipt_minor:'0',private_snapshot:'PRIVATE',accounts:[{binding_id:binding,account_id:'adacct_fictional',account_label:'=FICTIONAL ACCOUNT()',timezone:'America/Vancouver',stage:'published',source_id:org,source_ready:true,draft_id:org,draft_total_cny_minor:'60500',statement_id:bill,published_at:'2024-02-01T00:00:00Z',posted_total_cny_minor:'60500',rate:'PRIVATE'}]},
 payments:{reversal_enabled:true,statement_count:1,payment_count:0,statements:[{id:bill,account_name:'FICTIONAL',month:'2024-01-01',procurement_cad_minor:'11000',verified_cad_minor:'0',pending_cad_minor:'0'}],payments:[],private_snapshot:'PRIVATE'},
 reads:{statement_count:1,statements:[{statement_id:bill,confirmation_count:0,last_confirmed_at:null,phone_hint:'PRIVATE'}]},
 questions:{organization_id:org,month:'2024-01-01',total_count:0,open_count:0,in_progress_count:0,resolved_count:0,truncated:false,rows:[]}};}
export const checklist=()=>buildMonthCloseChecklist(checklistInput())!;
