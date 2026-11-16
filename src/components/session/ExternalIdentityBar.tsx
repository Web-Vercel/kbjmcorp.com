'use client';
import {usePathname} from 'next/navigation';
import type {Locale} from '@/lib/content';
import styles from './ExternalIdentityBar.module.css';
type Props={locale:Locale;email?:string;label:string;role:'client'|'agent'|'investor'|'sales';company:string};
export default function ExternalIdentityBar({locale,email,label,role,company}:Props){
 const path=usePathname();if(path.endsWith('/login'))return null;const zh=locale==='zh';
 const roleName=zh?{client:'企业客户',agent:'外部合作代理',investor:'投资人（只读）',sales:'销售与客户服务'}[role]:{client:'Client',agent:'External agent',investor:'Investor (read only)',sales:'Sales and client service'}[role];
 const scope=role==='agent'?(zh?'本人代理业务':'Own agent records'):role==='investor'?(zh?'全部授权企业的业务资料（只读）':'Authorized companies (read only)'):company;
 return <aside className={styles.bar} aria-label={zh?'当前登录身份':'Current signed-in identity'}><div><strong>{zh?'当前登录：':'Signed in: '}<span data-workspace-value>{email||(zh?'邮箱未提供':'Email unavailable')}</span></strong><span>{zh?'账号名称：':'Account: '}<b data-workspace-value>{label}</b><span className={styles.role}>{zh?'角色：':'Role: '}<b>{roleName}</b></span></span><span>{role==='client'||role==='sales'?(zh?'所属企业：':'Company: '):(zh?'访问范围：':'Scope: ')}<b data-workspace-value>{scope}</b></span></div></aside>;
}
