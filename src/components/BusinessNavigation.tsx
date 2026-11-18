"use client";
import Link from 'next/link';
import type {OpsContext} from '@/lib/operations/model';
import {canVisitOperationsPage,operationsMenuLabel} from '@/lib/operations/navigation';
import {usePathname} from 'next/navigation';
import type {Locale} from '@/lib/content';
import styles from './BusinessNavigation.module.css';
import SignOutButton from './SignOutButton';

const sections = {
  operations: {title: ['业务管理中心', 'Business management center'], pages: {
    agents: ['代理业务', 'Agent business'],
    refunds: ['客户余额退款', 'Balance refunds'],
    'manual-accounts': ['手工关联广告账户', 'Manual account links'],
    'manual-sources': ['手工报表交接', 'Manual report handoff'],
    'manual-finance': ['手工核对草稿', 'Manual reconciliation drafts'],
    'fund-summary': ['入账资金摘要', 'Posted fund summary'],
    'service-requests': ['服务工单', 'Service requests'],
    staff: ['人员职责', 'Staff responsibilities'],
    'month-close': ['月结工作台', 'Month close'],
    'ads-reporting': ['广告数据同步', 'Advertising data sync'],
    'source-data': ['广告来源资料', 'Advertising sources'],
    'source-checks': ['整月活动覆盖核实', 'Monthly coverage checks'],
    pricing: ['报价管理', 'Pricing'],
    settlements: ['月度结算制单与复核', 'Settlement preparation and review'],
    collections: ['对公收款与入账', 'Bank collections and posting'],
    funds: ['客户资金对账', 'Client funds reconciliation'],
    upstream: ['公司间采购对账', 'Intercompany procurement'],
    'upstream-payments': ['公司间到账核对', 'Intercompany receipts'],
    'statement-questions': ['账单问题跟进', 'Billing questions'],
    contracts: ['合同详情', 'Contract details'],
  }},
  account: {title: ['客户中心', 'Client center'], pages: {
    statements: ['客户账单', 'Statements'], funds: ['客户资金', 'Funds'],
    service: ['服务与账单问题', 'Service and billing questions'],
    company: ['企业资料', 'Company profile'], application: ['企业申请', 'Business application'],
    projects: ['项目详情', 'Project details'], reports: ['报告详情', 'Report details'],
    contracts: ['合同详情', 'Contract details'],
  }},
  access: {title: ['业务门户', 'Business portal'], pages: {
    security: ['账号安全', 'Account security'], investor: ['投资人业务查阅', 'Investor workspace'],
    analytics: ['经营与广告分析', 'Business and advertising analytics'],
  }},
} as const;

export default function BusinessNavigation({locale, section, role, operationsContext,canAdminWorkspace=false}: {canAdminWorkspace?:boolean;operationsContext?:OpsContext|null;locale: Locale; section: keyof typeof sections; role?: 'client' | 'investor' | 'sales' | 'agent'}) {
  const path = usePathname();
  if (path === `/${locale}/access/login` || (section === 'access' && !role)) return null;
  if (role === 'agent') return null;
  if (role === 'client' && (section === 'access' || section === 'account')) {
    const zh = locale === 'zh';
    const links = [
      ['access', zh ? '客户总览' : 'Client overview'],
      ['account/statements', zh ? '账单与下载' : 'Statements and downloads'],
      ['account/funds', zh ? '月度资金对账' : 'Monthly funds statements'],
      ['access/analytics', zh ? '广告与费用分析' : 'Advertising and cost analysis'],
      ['account/service', zh ? '服务与账单问题' : 'Service and billing questions'],
      ['account/refunds', zh ? '申请退款' : 'Balance refunds'],
      ['access/security', zh ? '账号安全' : 'Account security'],
    ];
    const clientMenuPath=path===`/${locale}/account/payment-notices`?`/${locale}/access`:path;
    const selected = links.find(([route]) => clientMenuPath === `/${locale}/${route}`);
    return <div className={styles.bar}>
      <nav aria-label={zh ? '当前位置' : 'Breadcrumb'} className={styles.path}>
        <Link href={`/${locale}/access`}>{zh ? '客户中心' : 'Client center'}</Link>
        {selected && <><span aria-hidden="true"> › </span><span aria-current="page">{selected[1]}</span></>}
      </nav>
      <div className={styles.clientRow}><nav className={styles.clientMenu} aria-label={zh ? '客户主菜单' : 'Client navigation'}>
        {links.map(([route, label]) => <Link key={route} href={`/${locale}/${route}`} aria-current={clientMenuPath === `/${locale}/${route}` ? 'page' : undefined}>{label}</Link>)}
      </nav><div className={styles.signOut}><SignOutButton locale={locale} destination={`/${locale}/access/login`}/></div></div>
    </div>;
  }
  const activeSection=(role==='investor'||role==='sales')&&section==='account'?'access':section;
  const root = `/${locale}/${activeSection}`;
  const parts = path.startsWith(root+'/')?path.slice(root.length).split('/').filter(Boolean):[];
  if (parts[0] === 'login') return null;
  const config = sections[activeSection];
  const index = locale === 'zh' ? 0 : 1;
  const pages = config.pages as Record<string, readonly string[]>;
  const current = pages[parts[0]];
  const title = config.title[index];
  const label=(key:string,names:readonly string[])=>activeSection==='operations'?operationsMenuLabel(key,names,operationsContext,locale):activeSection==='access'&&key==='analytics'&&role==='sales'?(locale==='zh'?'客户跟进分析':'Client follow-up analysis'):names[index];
  return <div className={styles.bar}>
    <nav aria-label={index === 0 ? '当前位置' : 'Breadcrumb'} className={styles.path}>
      {current ? <><Link href={root}>{title}</Link><span aria-hidden="true"> › </span><span aria-current="page">{label(parts[0],current)}</span></> : <span aria-current="page">{title}</span>}
    </nav>
    {activeSection==='operations'&&canAdminWorkspace&&<Link className={styles.workspaceSwitch} href={`/${locale}/admin`}>{locale==='zh'?'← 业务管理中心':'← Business management center'}</Link>}
    <details className={styles.menu}><summary>{index === 0 ? '本中心菜单' : 'Workspace menu'}</summary>
      <nav aria-label={title}>
        <Link href={root} aria-current={path===root?'page':undefined}>{title}</Link>
        {Object.entries(pages).filter(([key]) => !['contracts', 'projects', 'reports'].includes(key) && (activeSection !== 'operations' || canVisitOperationsPage(operationsContext,key)) && (activeSection !== 'access' || (role && (key !== 'investor' || role === 'investor')))).map(([key, names]) => <Link key={key} href={`${root}/${key}`} aria-current={parts[0] === key ? 'page' : undefined}>{label(key,names)}</Link>)}
      </nav>
    </details>
  </div>;
}
