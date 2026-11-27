import {redirect,notFound} from 'next/navigation';
import MonthCloseDetails from '@/components/operations/MonthCloseDetails';
export const dynamic='force-dynamic';
export const metadata={title:'账单工作台 | 智点未来',robots:{index:false,follow:false}};
type Props={params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string;list?:string;view?:string}>};
export default async function MonthClose(props:Props){
 const {locale}=await props.params;if(locale!=='zh'&&locale!=='en')notFound();
 const query=await props.searchParams;if(query.view&&query.view!=='details')notFound();
 if(query.view==='details'||query.list)return MonthCloseDetails(props);
 const scope=new URLSearchParams({...query.company?{company:query.company}:{},...query.month?{month:query.month}:{}});
 redirect(`/${locale}/operations/settlements${scope.size?'?'+scope:''}`);
}
