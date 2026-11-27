import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireOperations} from '@/lib/operations/server';
import {monthCloseOverview} from '@/lib/operations/month-close-overview';
import {localDate,addDays} from '@/lib/ads/report-model';
import MonthlyAutomationSettings from '@/components/operations/MonthlyAutomationSettings';
import RecordPicker from '@/components/workspace/RecordPicker';
export const dynamic='force-dynamic';
export const metadata={title:'自动月结 | 智点未来',robots:{index:false,follow:false}};
export default async function Automation({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';
 const {client,context}=await requireOperations(locale);if(!context?.owner)notFound();
 const query=await searchParams;if(query.company&&!z.uuid().safeParse(query.company).success)notFound();if(query.month&&!z.iso.date().safeParse(query.month+'-01').success)notFound();
 const month=query.month||addDays(localDate(new Date(),'America/Vancouver').slice(0,7)+'-01',-1).slice(0,7);
 const orgs=await client.from('organizations').select('id,name').order('name').limit(500);const company=query.company||orgs.data?.[0]?.id;
 if(company&&!orgs.error&&!orgs.data?.some(o=>o.id===company))notFound();
 const result=company&&!orgs.error?await client.rpc('get_month_close_overview',{p_org:company,p_month:month+'-01'}):null;
 const data=result&&!result.error?monthCloseOverview(result.data,{organizationId:company!,month:month+'-01'}):null;
 return <main className="wrap section client-workspace"><h1>{zh?'自动月结':'Automatic monthly preparation'}</h1><p>{zh?'管理定时制单设置和后台任务。':'Manage scheduled preparation and background jobs.'}</p><form className="admin-filter"><label>{zh?'客户企业':'Client company'}<select name="company" defaultValue={company}>{orgs.data?.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>{zh?'查看月份':'View month'}<input name="month" type="month" required defaultValue={month}/></label><button className="button">{zh?'查看自动月结':'View automation'}</button></form>{orgs.error||(company&&!data)?<p className="admin-error">{zh?'暂时无法读取账户及任务范围，请刷新核查。':'Account scope unavailable. Refresh and check.'}</p>:data?.accounts.length?<section className="admin-panel"><h2>{zh?'自动化管理':'Automation management'}</h2><RecordPicker label={zh?'选择自动月结账户':'Select automation account'} locale={locale} hashPrefix="automation-account-" items={data.accounts.map(a=>({id:a.binding_id,label:a.account_label,content:<article><h3 data-workspace-value>{a.account_label}</h3>{a.active?<MonthlyAutomationSettings locale={locale} bindingId={a.binding_id} company={company}/>:<p>{zh?'账户归属访问已暂停；请先核查绑定。':'Account binding is paused; check ownership first.'}</p>}</article>}))}/></section>:<p>{zh?'本企业尚无广告账户绑定，请先在手动办理中读取账户并确认归属。':'No advertiser binding. Read the account and confirm ownership in manual processing first.'}</p>}<p><Link className="service-link" href={`/${locale}/operations/settlements?${new URLSearchParams({...(company?{company}:{}),month})}`}>{zh?'查看账单与复核':'View statements and review'}</Link></p><p>{zh?'这里选择的月份仅用于查阅进度。':'The month selects workflow context only.'}</p></main>;
}
