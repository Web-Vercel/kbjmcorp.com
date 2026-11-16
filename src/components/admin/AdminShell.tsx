import Link from "next/link";
import type {OpsContext} from "@/lib/operations/model";
import InternalBreadcrumbs,{WorkspaceLanguageLink} from "@/components/workspace/InternalBreadcrumbs";
import workspaceStyles from "@/components/workspace/InternalWorkspace.module.css";
import {BrandMark} from "@/components/BrandLogo";
import brandStyles from "./AdminBrandMark.module.css";
import type { Locale } from "@/lib/content";
import { adminContent } from "@/lib/admin/content";
import AdminNavigation from "./AdminNavigation";
import AdminBreadcrumbs from "./AdminBreadcrumbs";
import SignOutButton from "@/components/SignOutButton";
export default function AdminShell({locale,children,demo=false,identity,staffRole,canFinance=false,operationsContext,canManage=staffRole==='admin',operations=false}:{operationsContext?:OpsContext|null;canManage?:boolean;operations?:boolean;staffRole?:'admin'|'operator';canFinance?:boolean;locale:Locale;children:React.ReactNode;demo?:boolean;identity?:React.ReactNode}){
 const t=adminContent[locale];
 const Content=operations?'div':'main';
 return <div className={`admin-app ${!demo?workspaceStyles.shell:''}`}><aside className="admin-sidebar"><Link className="admin-brand" href={demo?`/${locale}/admin-preview`:`/${locale}/${canManage?'admin':'operations'}`}><span className={brandStyles.plate}><BrandMark/></span><span>智点未来<small>{t.title}</small></span></Link><AdminNavigation locale={locale} demo={demo} staffRole={staffRole} canFinance={canFinance} context={operationsContext} canManage={canManage}/><div className="admin-sidebar-bottom"><span>{demo?t.demo:t.role}</span><Link href={`/${locale}`}>{locale==="zh"?"返回网站":"Public website"} ↗</Link></div></aside><div className="admin-main">{identity}<header className="admin-topbar">{demo?<AdminBreadcrumbs locale={locale} demo={demo}/>:<InternalBreadcrumbs locale={locale} context={operationsContext} canManage={canManage} admin={staffRole==='admin'}/>}<div><span className={`admin-source${demo?" is-demo":""}`}>{demo?t.demo:t.source}</span>{!demo?<WorkspaceLanguageLink locale={locale}/>:<Link href={`/${locale==="zh"?"en":"zh"}/${demo?"admin-preview":"admin"}`}>{locale==="zh"?"EN":"简体中文"}</Link>}{!demo&&!identity&&<SignOutButton locale={locale} mode="staff"/>}</div></header><Content className={`admin-content ${operations?workspaceStyles.operations:''}`}>{demo&&<p className="admin-demo-banner">{t.demoNotice}</p>}{children}{demo&&<Link className="service-link" href={`/${locale}/client-preview`}>{locale==="zh"?"查看客户中心演示":"View client preview"} ↗</Link>}<p className="admin-time-note">{locale==="zh"?"显示时间：温哥华（America/Vancouver）":"Displayed time: America/Vancouver"}</p></Content></div></div>;
}
