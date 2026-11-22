import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
import {getLiveContext} from '@/lib/live-access/server';
import {investorCatalog} from '@/lib/live-access/investor-catalog';
import {investorCell,investorColumn} from '@/lib/live-access/investor-display';
export const dynamic='force-dynamic';
export const metadata={title:'投资人业务查阅 | 智点未来',robots:{index:false,follow:false}};
const resultSchema=z.object({section:z.string(),offset:z.number().int().nonnegative(),limit:z.literal(25),total:z.number().int().nonnegative(),rows:z.array(z.record(z.string(),z.string().nullable())).max(25)});

export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{section?:string;page?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh',c=await getLiveContext();if('error'in c)redirect(`/${locale}/access/${c.error==='mfa_required'?'security':'login'}`);if(c.context.role!=='investor')notFound();
 const q=await searchParams,section=investorCatalog.find(s=>s.key===(q.section||'organizations'));if(!section)notFound();const page=z.coerce.number().int().min(1).max(85899344).safeParse(q.page||'1');if(!page.success)notFound();const offset=(page.data-1)*25;
 const r=await c.client.rpc('read_investor_business',{p_section:section.key,p_offset:offset,p_limit:25});const parsed=resultSchema.safeParse(r.data);const data=!r.error&&parsed.success&&parsed.data.section===section.key&&parsed.data.offset===offset?parsed.data:null;
 const href=(p:number)=>`/${locale}/access/investor?${new URLSearchParams({section:section.key,page:String(p)})}`;
 return <main className="wrap section client-workspace"><h1>{zh?'投资人业务查阅':'Investor business review'}</h1><p>{c.context.label} · {zh?'全部企业 · 只读':'All companies · Read only'}</p><p className="admin-notice">{zh?'可以查阅全部企业的经营、项目、广告、合同及财务业务记录。所有提交、修改、审批、扣费和权限管理均不开放。':'Review business, projects, ads, contracts and finance across all companies. Submission, edits, approval, debits and access administration are unavailable.'}</p><p><Link href={`/${locale}/access/analytics`}>{zh?'查看经营分析仪表盘':'Open analytics dashboard'}</Link></p><Link href={`/${locale}/access`}>{zh?'返回业务工作台':'Back to business workspace'}</Link><section className="admin-panel"><h2>{zh?section.zh:section.en}</h2>{!data?<p role="alert">{zh?'业务资料暂不可用，请联系管理员核对服务配置。':'Business records are unavailable. Ask an administrator to check service configuration.'}</p>:<><p>{zh?`共 ${data.total} 条 · 第 ${page.data} 页`:`${data.total} records · Page ${page.data}`}</p>{data.rows.length?<div style={{overflowX:'auto'}}><table><thead><tr>{section.columns.map(key=><th key={key}>{investorColumn(key,locale)}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={i}>{section.columns.map(key=><td key={key} style={{verticalAlign:'top',minWidth:140,maxWidth:420,overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{investorCell(key,row[key])}</td>)}</tr>)}</tbody></table></div>:<p>{zh?'本页没有记录。':'No records on this page.'}</p>}<p>{page.data>1&&<Link href={href(page.data-1)}>{zh?'上一页':'Previous'}</Link>} {' '} {offset+25<data.total&&page.data<85899344&&<Link href={href(page.data+1)}>{zh?'下一页':'Next'}</Link>}</p></>}</section></main>;
}
