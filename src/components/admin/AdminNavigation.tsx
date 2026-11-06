"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/content";
import { adminContent } from "@/lib/admin/content";
export default function AdminNavigation({locale,demo}:{locale:Locale;demo:boolean}){
 const t=adminContent[locale];const path=usePathname();
 const items=[["",t.overview,"◫"],["/inquiries",t.inquiries,"◎"],["/projects",t.projects,"▤"],["/accounts",t.accounts,"◇"] ,...(!demo?[["/applications",locale==="zh"?"企业申请审核":"Business applications","◎"],["/crm",locale==="zh"?"企业客户 CRM":"Client CRM","▣"],["/clients",locale==="zh"?"客户访问权限":"Client access","♧"]]:[])];
 return <nav className="admin-nav" aria-label={locale==="zh"?"后台导航":"Workspace navigation"}>{items.map(([suffix,label,icon])=>{
 const href=demo?`/${locale}/admin-preview${suffix?`#${suffix.slice(1)}`:""}`:`/${locale}/admin${suffix}`;
 const active=demo?!suffix:suffix?path.includes(`/admin${suffix}`):path===`/${locale}/admin`;
 return <Link href={href} key={suffix} aria-current={active?"page":undefined}><span aria-hidden="true">{icon}</span>{label}</Link>;
 })}<Link href={`/${locale}/${demo?"operations-preview":"operations"}`}>{locale==="zh"?"三方运营中心":"Three-party operations"} ↗</Link><Link href={`/${locale}/${demo?"collections-preview":"operations/collections"}`}>{locale==="zh"?"对公收款与入账":"Bank collections & posting"} ↗</Link>{demo&&<Link href={`/${locale}/application-preview`}>{locale==="zh"?"企业申请流程演示":"Business application demo"} ↗</Link>}{demo&&<Link href={`/${locale}/crm-preview`}>{locale==="zh"?"企业客户 CRM 演示":"Client CRM demo"} ↗</Link>}</nav>;
}
