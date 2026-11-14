import {requireOperations} from '@/lib/operations/server';
import {notFound} from 'next/navigation';
import RefundWorkspace from '@/components/partners/RefundWorkspace';
export const dynamic='force-dynamic';export const metadata={title:'余额退款 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const {client,context}=await requireOperations(locale);if(!context||!(context.owner||context.canPrepare||context.canReview))notFound();return <RefundWorkspace client={client} locale={locale} internal owner={context.owner} canPrepare={context.owner||context.canPrepare} canReview={context.owner||context.canReview}/>;}
