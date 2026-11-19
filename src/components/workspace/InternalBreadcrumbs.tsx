'use client';
import {workflowGroup} from '@/lib/operations/workflow-groups';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {OpsContext} from '@/lib/operations/model';
import {workspaceGroups} from '@/lib/operations/workspace-navigation';
export default function InternalBreadcrumbs({locale,context,canManage,admin}:{locale:'zh'|'en';context?:OpsContext|null;canManage:boolean;admin:boolean}){
 const actual=usePathname();const workflow=actual.startsWith(`/${locale}/operations/`)?workflowGroup(actual.split('/')[3]):undefined;const matched=workflow?workspaceGroups(locale,context,canManage,admin).flatMap(g=>g.items).find(i=>i.path.startsWith('operations/')&&workflowGroup(i.path.slice(11))?.key===workflow.key):undefined;const path=matched?`/${locale}/${matched.path}`:actual;const home=`/${locale}/${canManage?'admin':'operations'}`;
 const groups=workspaceGroups(locale,context,canManage,admin);
 const group=groups.find(g=>g.items.some(i=>path===`/${locale}/${i.path}`||path.startsWith(`/${locale}/${i.path}/`)));
 const item=group?.items.find(i=>path===`/${locale}/${i.path}`||path.startsWith(`/${locale}/${i.path}/`));
 return <nav aria-label={locale==='zh'?'当前位置':'Breadcrumb'}><Link href={home}>{locale==='zh'?'业务管理中心':'Business management center'}</Link><span aria-hidden="true"> › </span>{group&&<><span>{group.label}</span><span aria-hidden="true"> › </span></>}<span aria-current="page">{item?.label||(path===home||path===`/${locale}/operations`?locale==='zh'?'工作总览':'Work overview':locale==='zh'?'业务详情':'Business details')}</span></nav>;
}
export function WorkspaceLanguageLink({locale}:{locale:'zh'|'en'}){const path=usePathname();return <Link href={path.replace(`/${locale}`,`/${locale==='zh'?'en':'zh'}`)}>{locale==='zh'?'EN':'简体中文'}</Link>;}
