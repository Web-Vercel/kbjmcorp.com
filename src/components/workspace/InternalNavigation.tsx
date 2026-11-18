'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {OpsContext} from '@/lib/operations/model';
import {workspaceGroups} from '@/lib/operations/workspace-navigation';
import styles from './InternalWorkspace.module.css';
export default function InternalNavigation({locale,context,canManage,admin}:{locale:'zh'|'en';context?:OpsContext|null;canManage:boolean;admin:boolean}){
 const path=usePathname();const [expanded,setExpanded]=useState(false);
 useEffect(()=>{setExpanded(false);},[path]);
 const groups=workspaceGroups(locale,context,canManage,admin);
 const activeHref=groups.flatMap(group=>group.items).map(item=>`/${locale}/${item.path}`).filter(href=>path===href||path.startsWith(href+'/')).sort((a,b)=>b.length-a.length)[0];
 const home=`/${locale}/${canManage?'admin':'operations'}`;
 return <><button className={styles.mobileToggle} type="button" aria-expanded={expanded} aria-controls="internal-workspace-navigation" onClick={()=>setExpanded(value=>!value)}>{locale==='zh'?'工作菜单':'Work menu'} {expanded?'▴':'▾'}</button><nav id="internal-workspace-navigation" data-expanded={expanded} className={`admin-nav ${styles.navigation}`} aria-label={locale==='zh'?'业务管理导航':'Business management navigation'}>
  <Link href={home} aria-current={path===home?'page':undefined}>{locale==='zh'?'工作总览':'Work overview'}</Link>
  {groups.map(group=><details key={group.key} open={group.items.some(item=>path===`/${locale}/${item.path}`||path.startsWith(`/${locale}/${item.path}/`))}><summary>{group.label}</summary>{group.items.map(item=>{const href=`/${locale}/${item.path}`;return <Link key={href} href={href} aria-current={href===activeHref?'page':undefined}>{item.label}</Link>;})}</details>)}
 </nav></>;
}
