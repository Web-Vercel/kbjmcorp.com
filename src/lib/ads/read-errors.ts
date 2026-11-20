import {canonicalReportingTimezone} from './report-timezone';
import {z} from 'zod';
const timezone=z.string().max(100).refine(value=>value==='unrecognized'||canonicalReportingTimezone(value)!==null);
export const adsFailureSchema=z.object({phase:z.enum(['account','daily','period','check','storage_lookup','storage_save','read']),httpStatus:z.number().int().min(100).max(599).optional(),networkCode:z.enum(['timeout','dns','connection','tls','network']).optional(),validation:z.enum(['invalid_amount','amount_precision','amount_range','timestamp','partial_day','daily_label','timezone','account','daily_bucket','total_range','multiple_totals']).optional(),source:z.enum(['daily','period']).optional(),actualSince:z.iso.date().optional(),actualUntil:z.iso.date().optional(),expectedSince:z.iso.date().optional(),expectedUntil:z.iso.date().optional(),localTime:z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),expectedTimezone:timezone.optional(),actualTimezone:timezone.optional(),precision:z.number().int().min(0).max(200).optional()});
export type AdsFailure=z.infer<typeof adsFailureSchema>;
export type AdsErrorCode='invalid_period'|'not_configured'|'upstream_auth'|'upstream_rate_limit'|'upstream_unavailable'|'invalid_response'|'account_mismatch';
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
 const checks={invalid_amount:['金额格式不符','Invalid amount format'],amount_precision:['上游金额精度超过当前支持范围','Upstream amount precision exceeds supported scale'],amount_range:['金额超出支持范围','Amount exceeds supported range'],timestamp:['时间戳格式不符','Invalid timestamp'],partial_day:['返回边界不是账户当地午夜','Returned boundary is not account-local midnight'],daily_label:['日期标签与时间戳不一致','Date label differs from timestamp'],timezone:['返回时区与账户时区不一致','Timezone differs from account'],account:['返回账户不一致','Account differs'],daily_bucket:['每日日期重复或边界不符','Duplicate or invalid daily bucket'],total_range:['期间总额日期边界不符','Period-total boundaries differ'],multiple_totals:['期间总额返回多条记录','Multiple period-total rows']};
 return [names[d.phase][zh?0:1],d.httpStatus?`HTTP ${d.httpStatus}`:'',d.networkCode?network[d.networkCode][zh?0:1]:'',d.validation?checks[d.validation][zh?0:1]:'',d.source?(d.source==='daily'?(zh?'每日记录':'Daily row'):(zh?'期间记录':'Period row')):'',d.expectedTimezone?(zh?`账户时区=${d.expectedTimezone}`:`account timezone=${d.expectedTimezone}`):'',d.actualTimezone?(zh?`返回时区=${d.actualTimezone}`:`returned timezone=${d.actualTimezone}`):'',d.localTime?`local=${d.localTime}`:'',d.actualSince?`actual=${d.actualSince}${d.actualUntil?' → '+d.actualUntil:''}`:'',d.expectedSince?`expected=${d.expectedSince}${d.expectedUntil?' → '+d.expectedUntil:''}`:'',d.precision!==undefined?`scale=${d.precision}`:''].filter(Boolean).join(' · ');
}
