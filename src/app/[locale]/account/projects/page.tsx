import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireClientPage} from '@/lib/client/page';
import {loadClientWorkspace} from '@/lib/client/data';
import ClientWorkspace from '@/components/client/ClientWorkspace';
export const dynamic='force-dynamic';
export default async function Projects({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const {client,user}=await requireClientPage(locale);const data=await loadClientWorkspace(client,user.id);
 return <main className="wrap section client-workspace"><Link className="service-link" href={`/${locale}/access`}>← {locale==='zh'?'返回客户总览':'Back to client overview'}</Link><h1>{locale==='zh'?'项目进度':'Project progress'}</h1><ClientWorkspace locale={locale} {...data}/></main>;
}
