"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {Locale} from '@/lib/content';
import styles from './BusinessNavigation.module.css';

const sections = {
  operations: {title: ['三方运营中心', 'Three-party operations'], pages: {
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

export default function BusinessNavigation({locale, section, role}: {locale: Locale; section: keyof typeof sections; role?: 'client' | 'investor' | 'sales'}) {
  const path = usePathname();
  const root = `/${locale}/${section}`;
  const parts = path.slice(root.length).split('/').filter(Boolean);
  if (parts[0] === 'login') return null;
  const config = sections[section];
  const index = locale === 'zh' ? 0 : 1;
  const pages = config.pages as Record<string, readonly string[]>;
  const current = pages[parts[0]];
  const title = config.title[index];
  return <div className={styles.bar}>
    <nav aria-label={index === 0 ? '当前位置' : 'Breadcrumb'} className={styles.path}>
      {current ? <><Link href={root}>{title}</Link><span aria-hidden="true"> › </span><span aria-current="page">{current[index]}</span></> : <span aria-current="page">{title}</span>}
    </nav>
    <details className={styles.menu}><summary>{index === 0 ? '本中心菜单' : 'Workspace menu'}</summary>
      <nav aria-label={title}>
        <Link href={root}>{title}</Link>
        {Object.entries(pages).filter(([key]) => !['contracts', 'projects', 'reports'].includes(key) && (section !== 'access' || (role && (key !== 'investor' || role === 'investor')))).map(([key, names]) => <Link key={key} href={`${root}/${key}`} aria-current={parts[0] === key ? 'page' : undefined}>{names[index]}</Link>)}
      </nav>
    </details>
  </div>;
}
