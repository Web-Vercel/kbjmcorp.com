'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {BrandMark} from '@/components/BrandLogo';
import ExternalIdentityBar from '@/components/session/ExternalIdentityBar';
import SignOutButton from '@/components/SignOutButton';
import {investorCatalog} from '@/lib/live-access/investor-catalog';
import type {Locale} from '@/lib/content';
import workspace from '@/components/workspace/InternalWorkspace.module.css';
import density from '@/components/workspace/InternalDensity.module.css';
import brand from '@/components/admin/AdminBrandMark.module.css';
import styles from './InvestorShell.module.css';

const groups=[
 {zh:'客户与项目',en:'Clients & projects',keys:['organizations','client_profiles','crm_contacts','crm_opportunities','inquiries','inquiry_notes','customer_applications','customer_application_history','client_contracts','projects','project_submissions','project_reviews','project_activity','live_sales_updates']},
 {zh:'广告与来源',en:'Advertising & sources',keys:['ad_accounts','campaigns','campaign_metrics_daily','ad_sync_runs','ads_reporting_snapshots','ads_reporting_bindings','ads_source_handoffs','ads_monthly_coverage_checks','ads_monthly_coverage_reviews','ops_source_packets','ops_reconciliations']},
 {zh:'财务与结算',en:'Finance & settlement',keys:['agency_fee_rule_drafts','agency_quote_snapshots','agency_quote_lifecycle','agency_quote_derivations','billing_fx_quotes','client_wallets','wallet_entries','client_topups','bank_receipts','monthly_ad_reports','monthly_ad_report_lines','monthly_settlement_drafts','monthly_settlement_reviews','monthly_client_statements','client_statement_read_receipts','upstream_payment_records','upstream_payment_allocations','upstream_payment_reviews','upstream_payment_reversals','upstream_reversal_reviews']},
 {zh:'服务与运营',en:'Service & operations',keys:['service_requests','service_request_messages','operating_units','client_operating_links']},
];
export default function InvestorShell({locale,email,label,company,children}:{locale:Locale;email?:string;label:string;company:string;children:React.ReactNode}){
 const [expanded,setExpanded]=useState(false);
 const path=usePathname(),query=useSearchParams(),zh=locale==='zh',root=`/${locale}/access`,selected=query.get('section')||'organizations',catalog=path===root+'/investor';
 const title=path===root?(zh?'工作总览':'Overview'):catalog?(zh?'业务资料查阅':'Business records'):path===root+'/analytics'?(zh?'经营与广告分析':'Business & advertising analytics'):(zh?'账号安全':'Account security');
 const other=locale==='zh'?'en':'zh',otherPath=path.replace(/^\/(zh|en)/,'/'+other)+(query.size?'?'+query.toString():'');
 return <div className={`admin-app ${workspace.shell} ${styles.shell}`}><aside className="admin-sidebar"><Link className="admin-brand" href={root}><span className={brand.plate}><BrandMark/></span><span>智点未来<small>{zh?'业务管理中心':'Business management center'}</small></span></Link><button type="button" className={workspace.mobileToggle} aria-expanded={expanded} aria-controls="investor-navigation" onClick={()=>setExpanded(value=>!value)}>{zh?'菜单':'Menu'} {expanded?'−':'+'}</button><nav id="investor-navigation" data-expanded={expanded} onClick={event=>{if((event.target as HTMLElement).closest('a'))setExpanded(false);}} className={workspace.navigation} aria-label={zh?'投资人只读菜单':'Investor read-only navigation'}><Link href={root} aria-current={path===root?'page':undefined}>{zh?'工作总览':'Overview'}</Link><Link href={root+'/analytics'} aria-current={path===root+'/analytics'?'page':undefined}>{zh?'经营与广告分析':'Business & advertising analytics'}</Link>{groups.map(group=><details key={group.en} open={catalog&&group.keys.includes(selected)}><summary>{zh?group.zh:group.en}</summary>{group.keys.map(key=>{const item=investorCatalog.find(item=>item.key===key);return item?<Link key={key} href={`${root}/investor?section=${key}`} aria-current={catalog&&selected===key?'page':undefined}>{zh?item.zh:item.en}</Link>:null;})}</details>)}<Link href={root+'/security'} aria-current={path===root+'/security'?'page':undefined}>{zh?'账号安全':'Account security'}</Link></nav><div className="admin-sidebar-bottom"><span>{zh?'投资人 · 只读':'Investor · Read only'}</span><Link href={'/'+locale}>{zh?'返回网站':'Public website'} ↗</Link></div></aside><div className="admin-main"><div className={styles.identity}><ExternalIdentityBar locale={locale} email={email} label={label} role="investor" company={company}/><div className={styles.logout}><SignOutButton locale={locale} destination={root+'/login'}/></div></div><header className="admin-topbar"><nav aria-label={zh?'当前位置':'Breadcrumb'}><Link href={root}>{zh?'业务管理中心':'Business management center'}</Link><span> › {title}</span></nav><div><span className="admin-source">{zh?'只读查阅':'Read-only access'}</span><Link href={otherPath}>{zh?'EN':'简体中文'}</Link></div></header><div className={`admin-content ${density.content} ${workspace.operations}`}>{children}</div></div></div>;
}
