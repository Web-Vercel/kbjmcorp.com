import 'server-only';
import {z} from 'zod';
const entries=z.array(z.object({accountId:z.string().regex(/^adacct_[A-Za-z0-9_-]+$/),label:z.string().trim().min(1).max(120),keyEnv:z.string().regex(/^ADS_REPORTING_KEY_[A-Z0-9_]+$/),currency:z.string().regex(/^[A-Z]{3}$/).optional(),enabled:z.boolean().default(true)})).max(10).superRefine((rows,ctx)=>{if(new Set(rows.map(r=>r.accountId)).size!==rows.length)ctx.addIssue({code:'custom',message:'Duplicate account'});});
export function additionalReportingConnections(){
 const raw=process.env.ADS_REPORTING_CONNECTIONS_JSON;if(!raw)return {invalid:false,connections:[]};
 try{const parsed=entries.safeParse(JSON.parse(raw));if(!parsed.success)return {invalid:true,connections:[]};
 if(parsed.data.some(c=>c.accountId===process.env.ADS_REPORTING_ACCOUNT_ID?.trim()))return {invalid:true,connections:[]};
 return {invalid:false,connections:parsed.data.map(c=>{const key=process.env[c.keyEnv]?.trim();return {...c,key:c.enabled&&key&&/^[\x21-\x7e]+$/.test(key)?key:null};})};
 }catch{return {invalid:true,connections:[]};}
}
/** Public-to-admin metadata only. API keys and their variable names never leave the server. */
export function reportingConnectionOptions(accountNames:Readonly<Record<string,string>>={}){
 const extra=additionalReportingConnections();const id=process.env.ADS_REPORTING_ACCOUNT_ID?.trim();
 return {invalid:extra.invalid,connections:[...(id&&/^adacct_[A-Za-z0-9_-]+$/.test(id)?[{accountId:id,label:accountNames[id]?.trim()||'账户名称待读取 / Account name pending',enabled:process.env.ADS_REPORTING_ENABLED?.trim().toLowerCase()==='true'}]:[]),...extra.connections.map(c=>({accountId:c.accountId,label:accountNames[c.accountId]?.trim()||c.label,enabled:c.enabled}))]};
}
