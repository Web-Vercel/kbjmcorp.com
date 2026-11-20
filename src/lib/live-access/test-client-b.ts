/** Preview-only convenience for the owner's existing Gmail alias and fictional company B. */
export function testClientBSetup(preview:boolean,ownerEmail:string|undefined,organizations:{id:string;name:string}[],accounts:{organization_id:string;role:string;expected_email:string;active:boolean}[]){
 if(!preview||!ownerEmail||!/^[-a-zA-Z0-9.+_]+@gmail\.com$/i.test(ownerEmail))return null;
 const matches=organizations.filter(o=>o.name==='测试企业B');if(matches.length!==1)return null;
 const organization=matches[0];const email=ownerEmail.split('@')[0].split('+')[0]+'+client-demoB@gmail.com';
 const existing=accounts.find(a=>a.organization_id===organization.id&&a.role==='client');
 if(existing)return {organization,email:existing.expected_email,existing:true,active:existing.active};
 if(accounts.some(a=>a.expected_email.toLowerCase()===email.toLowerCase()))return null;
 return {organization,email,existing:false,active:false};
}
