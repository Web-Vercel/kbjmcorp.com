import Link from "next/link";
import {BrandMark} from "@/components/BrandLogo";
import brandStyles from "./AdminBrandMark.module.css";
import type { Locale } from "@/lib/content";
import { adminContent } from "@/lib/admin/content";
import AdminNavigation from "./AdminNavigation";
import SignOutButton from "@/components/SignOutButton";
export default function AdminShell({locale,children,demo=false,identity}:{locale:Locale;children:React.ReactNode;demo?:boolean;identity?:React.ReactNode}){
 const t=adminContent[locale];
 return <div className="admin-app"><aside className="admin-sidebar"><Link className="admin-brand" href={`/${locale}`}><span className={brandStyles.plate}><BrandMark/></span><span>智点未来<small>{t.title}</small></span></Link><AdminNavigation locale={locale} demo={demo}/><div className="admin-sidebar-bottom"><span>{demo?t.demo:t.role}</span><Link href={`/${locale}`}>{locale==="zh"?"返回网站":"Public website"} ↗</Link></div></aside><div className="admin-main">{identity}<header className="admin-topbar"><span>{t.title}</span><div><span className={`admin-source${demo?" is-demo":""}`}>{demo?t.demo:t.source}</span><Link href={`/${locale==="zh"?"en":"zh"}/${demo?"admin-preview":"admin"}`}>{locale==="zh"?"EN":"简体中文"}</Link>{!demo&&!identity&&<SignOutButton locale={locale} mode="staff"/>}</div></header><main className="admin-content">{demo&&<p className="admin-demo-banner">{t.demoNotice}</p>}{children}{demo&&<Link className="service-link" href={`/${locale}/client-preview`}>{locale==="zh"?"查看客户中心演示":"View client preview"} ↗</Link>}<p className="admin-time-note">{locale==="zh"?"显示时间：温哥华（America/Vancouver）":"Displayed time: America/Vancouver"}</p></main></div></div>;
}
