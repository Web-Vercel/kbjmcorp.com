"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {Locale} from "@/lib/content";

const pages: Record<string, [string, string]> = {
  "role-accounts": ["业务账号权限", "Business account access"],
  clients: ["客户访问权限", "Client access"],
  inquiries: ["咨询与客户", "Inquiries and clients"],
  projects: ["广告项目", "Advertising projects"],
  accounts: ["广告账户", "Advertising accounts"],
  applications: ["企业申请审核", "Business applications"],
  crm: ["企业客户 CRM", "Client CRM"],
};

export default function AdminBreadcrumbs({locale, demo}: {locale: Locale; demo: boolean}) {
  const pathname = usePathname();
  const root = `/${locale}/${demo ? "admin-preview" : "admin"}`;
  const segments = pathname.startsWith(`${root}/`) ? pathname.slice(root.length + 1).split("/") : [];
  const page = pages[segments[0]];
  const zh = locale === "zh";
  return <nav aria-label={zh ? "当前位置" : "Breadcrumb"}>
    <Link href={root}>{zh ? "业务管理中心" : "Business management"}</Link>
    <span aria-hidden="true"> › </span>
    {page ? <>
      {segments.length > 1 ? <><Link href={`${root}/${segments[0]}`}>{page[zh ? 0 : 1]}</Link><span aria-hidden="true"> › </span><span aria-current="page">{zh ? "详情" : "Details"}</span></> : <span aria-current="page">{page[zh ? 0 : 1]}</span>}
    </> : <span aria-current="page">{zh ? "工作总览" : "Overview"}</span>}
  </nav>;
}
