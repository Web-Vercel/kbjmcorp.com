'use client';
import Link from 'next/link';
import {usePathname,useSearchParams} from 'next/navigation';
import type {OpsContext} from '@/lib/operations/model';
import {workflowGroup,workflowPages} from '@/lib/operations/workflow-groups';
import styles from './WorkflowNavigation.module.css';
export default function WorkflowNavigation({locale,context}:{locale:'zh'|'en';context:OpsContext|null}){
 const path=usePathname(),params=useSearchParams();const page=path.split('/')[3];const group=workflowGroup(page);if(!group)return null;
 const query=new URLSearchParams();for(const key of ['company','month']){const value=params.get(key);if(value)query.set(key,value);}
 const suffix=query.size?'?'+query.toString():'';
 return <section className={styles.panel} aria-label={locale==='zh'?'本项办理入口':'Workflow navigation'}><strong>{group[locale]}</strong><nav aria-label={group[locale]}>{workflowPages(group,context).map(([key,zh,en])=><Link key={key} href={`/${locale}/operations/${key}${suffix}`} aria-current={key===page?'page':undefined}>{locale==='zh'?zh:en}</Link>)}</nav>{query.size>0&&<small>{locale==='zh'?'保留当前企业及月份；各页面仍按你的权限核对。':'Company and month are retained; each page enforces your access.'}</small>}</section>;
}
