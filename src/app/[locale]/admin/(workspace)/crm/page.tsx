import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/admin/page";
import { clientStatus } from "@/lib/crm/content";
import AdminForm from "@/components/admin/AdminForm";
import ClientFields from "@/components/crm/ClientFields";
export default async function Clients({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{q?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const {client}=await requireStaffPage(locale);const zh=locale==='zh';const {q=''}=await searchParams;
 let query=client.from('organizations').select('id,name,created_at').order('created_at',{ascending:false}).limit(100);
 if(q.trim())query=query.ilike('name',`%${q.trim().slice(0,100).replace(/[%_\\]/g,'')}%`);
 const organizations=await query;
 const profiles=organizations.data?.length?await client.from('client_profiles').select('organization_id,legal_name,status').in('organization_id',organizations.data.map(o=>o.id)):{data:[],error:organizations.error};
 const states=new Map(profiles.data?.map(p=>[p.organization_id,p]));
 return <><div className="admin-page-heading"><div><p className="eyebrow">CRM</p><h1>{zh?'企业客户管理':'Client company CRM'}</h1></div><Link className="service-link" href={`/${locale}/crm-preview`}>{zh?'查看虚构流程演示':'Fictional workflow preview'} ↗</Link></div><p className="admin-notice">{zh?'可人工建立企业，无需先提交网站咨询。企业档案、联系人、登录授权和财务权限分别管理；录入手机号不会自动授权。':'Create a client manually without a website inquiry. Company records, contacts, login authorization and finance access are separate; entering a phone number does not grant access.'}</p><div className="admin-two-columns"><section className="admin-panel"><h2>{zh?'客户企业':'Client companies'}</h2><form className="admin-filter"><input name="q" defaultValue={q} aria-label={zh?'搜索企业名称':'Search company names'} placeholder={zh?'搜索企业名称':'Search company names'}/><button className="button">{zh?'搜索':'Search'}</button></form>{organizations.error||profiles.error?<p className="admin-error">{zh?'暂时无法读取客户。':'Clients are unavailable.'}</p>:organizations.data.map(org=><article className="admin-project" key={org.id}><h3><Link href={`/${locale}/admin/crm/${org.id}`}>{org.name} ↗</Link></h3><p>{states.get(org.id)?.legal_name|| (zh?'待完善企业资料':'Profile incomplete')}</p><span className="admin-badge">{clientStatus(states.get(org.id)?.status||'onboarding',locale)}</span></article>)}<p className="workflow-byline">{zh?'显示最多最近100家公司。':'Showing up to 100 recent companies.'}</p></section><section className="admin-panel"><h2>{zh?'人工建立新客户':'Create a client manually'}</h2><AdminForm locale={locale} endpoint="/api/admin/crm" button={zh?'建立企业档案':'Create company record'}><input type="hidden" name="action" value="client"/><ClientFields locale={locale}/></AdminForm></section></div></>;
}
