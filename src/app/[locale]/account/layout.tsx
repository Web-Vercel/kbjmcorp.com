import BusinessNavigation from '@/components/BusinessNavigation';
import {notFound} from 'next/navigation';
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 return <><BusinessNavigation locale={locale} section="account"/>{children}</>;
}
