import type {Metadata} from 'next';
import {clientReturnTo} from '@/lib/auth/client-return';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getClientTestLoginConfig} from '@/lib/auth/client-test-config';
import ClientTestLogin from '@/components/client/ClientTestLogin';
export const dynamic='force-dynamic';export const metadata:Metadata={title:'客户隔离验收登录 | 智点未来',robots:{index:false,follow:false}};
export default async function TestLogin({params,searchParams}:{params:Promise<{locale:string}>;searchParams?:Promise<{returnTo?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const config=getClientTestLoginConfig();if(!config)notFound();const zh=locale==='zh';const query=await searchParams||{};const returnTo=clientReturnTo(query.returnTo,locale);
 return <main id="main" className="admin-auth"><Link className="admin-auth-brand" href={`/${locale}`}>智点未来</Link><h1>{zh?'客户隔离验收登录':'Client isolation acceptance sign-in'}</h1><p className="admin-demo-banner">{zh?'仅限 Preview 中明确批准的两个测试客户账号。使用真实身份验证和公司授权，不是演示身份切换。管理员请使用独立浏览器窗口操作。':'For two explicitly approved test clients in Preview only. This uses real authentication and company authorization, not demo identity switching. Use a separate browser session from the administrator.'}</p><ClientTestLogin returnTo={returnTo} locale={locale} siteKey={config.siteKey}/><p className="workflow-byline">{zh?'此入口不注册账号、不授予权限、不发送短信。正式客户的手机号登录入口保持原有方案。':'This entry does not register users, grant access or send SMS. The standard customer phone sign-in remains separate.'}</p></main>;
}
