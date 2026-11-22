import Link from 'next/link';
import {cookies} from 'next/headers';
import {demoCookie} from '@/lib/demo/policy';
import {notFound} from 'next/navigation';
import {getStaffLoginConfig} from '@/lib/auth/config';
import StaffLogin from '@/components/admin/StaffLogin';
import DemoExitButton from '@/components/demo/DemoExitButton';
export const dynamic='force-dynamic';export const metadata={title:'客户与合作伙伴登录 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const cfg=getStaffLoginConfig(),zh=locale==='zh',oldDemo=(await cookies()).has(demoCookie);return <main className="admin-auth"><h1>{zh?'客户与合作伙伴登录':'Client and partner sign-in'}</h1><p><Link href={`/${locale}/admin/login`}>{zh?"企业员工登录 →":"Employee sign-in →"}</Link></p>{oldDemo?<><p role="alert">{zh?'旧演示中心已停用。请先清除旧演示会话，再使用真实业务账号登录。':'The old demo center is retired. Clear its session before signing in with your real business account.'}</p><DemoExitButton locale={locale} returnToLogin/></>:<StaffLogin locale={locale} enabled={!!cfg} siteKey={cfg?.siteKey||''} access/>}</main>}
