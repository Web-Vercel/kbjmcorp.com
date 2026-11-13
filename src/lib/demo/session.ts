import 'server-only';
import {createHmac,createHash,timingSafeEqual,scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
import {z} from 'zod';
import {demoSettingChecks} from './readiness';
import {demoCookie,trainingTracks} from './policy';
export {demoCookie};
const scrypt=promisify(derive);
export const demoRole=z.enum(['investor','client','training','sales']);
export type DemoRole=z.infer<typeof demoRole>;
const account=z.object({username:z.string().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),role:demoRole,salt:z.string().regex(/^[a-f0-9]{32}$/),passwordHash:z.string().regex(/^[a-f0-9]{128}$/),expiresAt:z.iso.datetime(),trainingTracks:z.array(z.enum(trainingTracks)).min(1).max(4).optional()}).superRefine((a,ctx)=>{if(a.trainingTracks&&(a.role!=='training'||new Set(a.trainingTracks).size!==a.trainingTracks.length))ctx.addIssue({code:'custom',message:'Invalid training assignment'});});
const payload=z.object({username:z.string(),role:demoRole,version:z.string().length(64),expires:z.number().int().positive()});
export function demoConfig(){
 if(process.env.DEMO_LOGIN_ENABLED!=='true')return null;
 const secret=process.env.DEMO_SESSION_SECRET;if(!secret||secret.length<32||secret.trim()!==secret||secret===process.env.AUTH_RATE_LIMIT_SECRET)return null;
 try{const parsed=z.array(account).min(1).max(100).parse(JSON.parse(process.env.DEMO_ACCOUNTS_JSON||''));if(new Set(parsed.map(a=>a.username)).size!==parsed.length)return null;return {secret,accounts:parsed};}catch{return null;}
}
export function demoReadiness(){return demoSettingChecks(value=>{const parsed=z.array(account).min(1).max(100).safeParse(value);return parsed.success&&new Set(parsed.data.map(a=>a.username)).size===parsed.data.length;});}
function version(a:z.infer<typeof account>){return createHash('sha256').update(JSON.stringify(a)).digest('hex');}
export async function demoLogin(username:string,password:string,now=Date.now()){
 const config=demoConfig();if(!config)return null;const a=config.accounts.find(a=>a.username===username);
 // Unknown accounts perform the same bounded password derivation.
 const hash=await scrypt(password,a?.salt??'0'.repeat(32),64) as Buffer;
 const valid=timingSafeEqual(hash,Buffer.from(a?.passwordHash??'0'.repeat(128),'hex'));
 if(!a||!valid||Date.parse(a.expiresAt)<=now)return null;
 const body=Buffer.from(JSON.stringify({username:a.username,role:a.role,version:version(a),expires:Math.min(now+8*3600000,Date.parse(a.expiresAt))})).toString('base64url');
 return {token:body+'.'+createHmac('sha256',config.secret).update(body).digest('base64url'),role:a.role};
}
export function demoSession(token:string|undefined,now=Date.now()){
 const config=demoConfig();if(!config||!token||token.length>2048)return null;
 try{const [body,signature,...extra]=token.split('.');if(extra.length||!body||!signature)return null;const expected=createHmac('sha256',config.secret).update(body).digest();const received=Buffer.from(signature,'base64url');if(received.length!==expected.length||!timingSafeEqual(received,expected))return null;
 const p=payload.parse(JSON.parse(Buffer.from(body,'base64url').toString()));const a=config.accounts.find(a=>a.username===p.username);if(!a||p.role!==a.role||p.version!==version(a)||p.expires<=now||p.expires>now+8*3600000||Date.parse(a.expiresAt)<p.expires)return null;
 return {username:p.username,role:p.role,expires:p.expires,trainingTracks:a.role==='training'?(a.trainingTracks??['sales']):[]};}catch{return null;}
}
