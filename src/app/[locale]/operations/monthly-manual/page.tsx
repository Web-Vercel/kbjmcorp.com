import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import {canVisitOperationsPage} from '@/lib/operations/navigation';
import {localDate,addDays} from '@/lib/ads/report-model';
export const dynamic='force-dynamic';
export const metadata={title:'手动办理 | 智点未来',robots:{index:false,follow:false}};
export default async function Manual({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();
 const query=await searchParams;if(query.company&&!z.uuid().safeParse(query.company).success)notFound();if(query.month&&!z.iso.date().safeParse(query.month+'-01').success)notFound();
 const month=query.month||addDays(localDate(new Date(),'America/Vancouver').slice(0,7)+'-01',-1).slice(0,7);
 const orgs=await client.from('organizations').select('id,name').order('name').limit(500);const company=query.company||orgs.data?.[0]?.id;if(company&&!orgs.error&&!orgs.data?.some(o=>o.id===company))notFound();
 const suffix=new URLSearchParams({...(company?{company}:{}),month}).toString();
 const steps=[['ads-reporting','读取平台数据与确认归属','Read platform source and ownership'],['source-data','查看来源与凭证','View source and evidence'],['source-checks','核实整月数据完整性','Verify monthly coverage'],['pricing','手动试算与报价','Manual estimate and pricing'],['settlements','手动关联来源与报价制单','Prepare from source and quote'],['manual-sources','手工提交报表','Submit manual reports'],['manual-finance','手工报表草稿与复核','Manual report drafts and review']] as const;
 return <main className="wrap section client-workspace"><h1>{zh?'手动办理':'Manual processing'}</h1><p>{zh?'用于特殊费用、来源补正和自动任务异常。先核查已有任务及草稿，避免重复制单；进入此页面不会暂停自动月结。':'For exceptional fees, source corrections and automation exceptions. Check existing jobs/drafts before preparing. Opening this page does not pause automation.'}</p><form className="admin-filter"><label>{zh?'客户企业':'Client company'}<select name="company" defaultValue={company}>{orgs.data?.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{zh?'办理月份':'Month'}<input name="month" type="month" required defaultValue={month}/></label><button className="button">{zh?'查看办理入口':'View processing options'}</button></form>{orgs.error?<p className="admin-error">{zh?'企业列表暂不可用。':'Company list unavailable.'}</p>:company&&<><section className="admin-panel"><h2>{zh?'手动操作':'Manual operations'}</h2>{steps.filter(([page])=>canVisitOperationsPage(context,page)&&(page!=='settlements'||context.owner||context.canPrepare)).map(([page,cn,en])=><p key={page}><Link className="service-link" href={`/${locale}/operations/${page}?${suffix}${page==='settlements'?'&mode=prepare':''}`}>{zh?cn:en}</Link></p>)}</section><p><Link className="service-link" href={`/${locale}/operations/month-close?${suffix}`}>{zh?'查看月结整体进度':'View overall month-close progress'}</Link>{' · '}<Link className="service-link" href={`/${locale}/operations/settlements?${suffix}`}>{zh?'查看统一账单与复核':'View shared statements and review'}</Link></p></>}</main>;
}
