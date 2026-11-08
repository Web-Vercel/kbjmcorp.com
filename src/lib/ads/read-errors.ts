import {z} from 'zod';
export const adsFailureSchema=z.object({phase:z.enum(['account','daily','period','check','storage_lookup','storage_save','read']),httpStatus:z.number().int().min(100).max(599).optional(),networkCode:z.enum(['timeout','dns','connection','tls','network']).optional()});
export type AdsFailure=z.infer<typeof adsFailureSchema>;
export type AdsErrorCode='not_configured'|'upstream_auth'|'upstream_rate_limit'|'upstream_unavailable'|'invalid_response'|'account_mismatch';
export class AdsReadError extends Error{constructor(public code:AdsErrorCode,public diagnostic?:AdsFailure){super(code);}}
export function safeNetworkCode(error:unknown,aborted:boolean):NonNullable<AdsFailure['networkCode']>{
 if(aborted)return 'timeout';
 const e=error as {name?:unknown;code?:unknown;cause?:{code?:unknown}}|null;const code=e?.cause?.code??e?.code;
 if(e?.name==='TimeoutError'||e?.name==='AbortError'||code==='UND_ERR_CONNECT_TIMEOUT'||code==='ETIMEDOUT')return 'timeout';
 if(code==='ENOTFOUND'||code==='EAI_AGAIN')return 'dns';
 if(code==='ECONNREFUSED'||code==='ECONNRESET'||code==='UND_ERR_SOCKET')return 'connection';
 if(code==='CERT_HAS_EXPIRED'||code==='UNABLE_TO_VERIFY_LEAF_SIGNATURE'||code==='DEPTH_ZERO_SELF_SIGNED_CERT')return 'tls';
 return 'network';
}
export function failureLabel(value:unknown,zh:boolean):string{
 const parsed=adsFailureSchema.safeParse(value);if(!parsed.success)return '';const d=parsed.data;
 const names={account:['账户信息','Account metadata'],daily:['每日报表','Daily report'],period:['期间总额','Period total'],check:['数据核对','Data checks'],storage_lookup:['来源存储查询','Snapshot lookup'],storage_save:['来源保存','Snapshot save'],read:['API读取','API read']};
 const network={timeout:['连接超时','Connection timeout'],dns:['域名解析失败','DNS resolution failed'],connection:['连接失败或中断','Connection failed or interrupted'],tls:['TLS证书验证失败','TLS verification failed'],network:['网络请求失败','Network request failed']};
 return [names[d.phase][zh?0:1],d.httpStatus?`HTTP ${d.httpStatus}`:'',d.networkCode?network[d.networkCode][zh?0:1]:''].filter(Boolean).join(' · ');
}
