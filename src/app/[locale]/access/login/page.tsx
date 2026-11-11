import {notFound} from 'next/navigation';
import {getStaffLoginConfig} from '@/lib/auth/config';
import StaffLogin from '@/components/admin/StaffLogin';
import DemoExitButton from '@/components/demo/DemoExitButton';
export const dynamic='force-dynamic';export const metadata={title:'业务账号登录 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const cfg=getStaffLoginConfig(),zh=locale==='zh';return <main className="admin-auth"><h1>{zh?'业务账号登录':'Business account sign-in'}</h1><p>{zh?'使用已开通的邮箱账号登录。这里访问真实业务记录，操作会保存。':'Sign in with a provisioned email account. This workspace uses real business records; actions persist.'}</p><StaffLogin locale={locale} enabled={!!cfg} siteKey={cfg?.siteKey||''} access/><DemoExitButton locale={locale}/></main>}
