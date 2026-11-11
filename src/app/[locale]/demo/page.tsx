import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {demoCookie,demoSession} from '@/lib/demo/session';
import DemoWorkspace from '@/components/demo/DemoWorkspace';
export const dynamic='force-dynamic';
export const metadata={title:'演示中心 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const session=demoSession((await cookies()).get(demoCookie)?.value);if(!session)redirect(`/${locale}/demo/login`);return <main className="wrap section client-workspace"><DemoWorkspace locale={locale} role={session.role} username={session.username} assignedTracks={session.trainingTracks}/></main>}
