import Link from 'next/link';
import {notFound} from 'next/navigation';
import {demoConfig} from '@/lib/demo/session';
import DemoExitButton from '@/components/demo/DemoExitButton';
import DemoLogin from '@/components/demo/DemoLogin';
export const dynamic='force-dynamic';
export const metadata={title:'演示中心登录 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const zh=locale==='zh';return <main className="admin-auth"><Link className="admin-auth-brand" href={`/${locale}`}>智点未来</Link><h1>{zh?'演示中心登录':'Demo center sign-in'}</h1><p className="admin-demo-banner">{zh?'供投资人、广告客户及销售体验。所有资料为虚构示例，演示操作不影响真实客户、广告和资金。':'For investors, advertisers and sales visitors. All data is fictional; demo actions do not affect real clients, advertising or funds.'}</p><DemoLogin locale={locale} enabled={!!demoConfig()}/><DemoExitButton locale={locale}/></main>}
