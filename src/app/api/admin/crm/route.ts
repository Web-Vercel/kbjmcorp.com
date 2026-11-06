import { crmActionSchema } from "@/lib/crm/validation";
import { contractTemplate } from "@/lib/crm/contract-template";
import { getStaffContext,staffError } from "@/lib/admin/guard";
import { authResponse,readAuthBody } from "@/lib/auth/http";
export async function POST(request:Request){
 const input=await readAuthBody(request,32768);if(input.error)return input.error;
 const parsed=crmActionSchema.safeParse(input.body);if(!parsed.success)return authResponse({error:'invalid_input'},400);
 const staff=await getStaffContext();if('error'in staff)return staffError(staff);
 const p=parsed.data;if(!['client','contact'].includes(p.action)&&staff.role!=='admin')return authResponse({error:'forbidden'},403);
 let call:string;let args:Record<string,unknown>;
 switch(p.action){
 case 'client':call='save_crm_client';args={p_organization_id:p.organizationId||null,p_name:p.name,p_legal_name:p.legalName,p_registration:p.registration,p_country:p.country,p_website:p.website,p_industry:p.industry,p_status:p.status,p_notes:p.notes,p_revision:p.revision};break;
 case 'contact':call='save_crm_contact';args={p_organization_id:p.organizationId,p_contact_id:p.contactId||null,p_name:p.name,p_title:p.title,p_phone:p.phone,p_email:p.email,p_kind:p.kind};break;
 case 'invite':call='invite_crm_contact';args={p_organization_id:p.organizationId,p_contact_id:p.contactId,p_business_role:p.businessRole,p_finance_role:p.financeRole,p_evidence:p.evidence};break;
 case 'revoke':call='revoke_crm_access';args={p_organization_id:p.organizationId,p_user_id:p.userId||null,p_invite_id:p.inviteId||null};break;
 case 'finance':call='set_crm_finance_access';args={p_organization_id:p.organizationId,p_user_id:p.userId,p_role:p.role};break;
 case 'wallet':call='open_crm_wallet';args={p_organization_id:p.organizationId};break;
 case 'contract':call='create_crm_contract';args={p_organization_id:p.organizationId,p_title:p.title,p_provider:p.provider,p_scope:p.scope,p_pricing:p.pricing,p_refund:p.refund,p_starts:p.starts,p_ends:p.ends,p_template_body:contractTemplate};break;
 case 'contractStatus':call='update_crm_contract';args={p_contract_id:p.contractId,p_status:p.status,p_client_visible:p.clientVisible==='yes',p_signature_reference:p.signatureReference,p_signed_on:p.signedOn||null,p_expected_status:p.expectedStatus};break;
 }
 try{const {data,error}=await staff.client.rpc(call,args);if(error){const status=error.code==='42501'?403:error.code==='40001'||error.code==='23505'?409:error.code==='P0002'?404:error.code==='22023'||error.code==='23514'||error.code==='23502'||error.code==='23503'?400:502;return authResponse({error:status===409?'conflict':'save_failed'},status);}return authResponse({ok:true,id:typeof data==='string'?data:undefined});}catch{return authResponse({error:'unavailable'},503);}
}
