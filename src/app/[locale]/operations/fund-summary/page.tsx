import {redirect,notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'资金查询 | 智点未来',robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{company?:string;month?:string;ticket?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();const input=await searchParams;const q=new URLSearchParams();if(input.company)q.set('company',input.company);if(input.month){q.set('month',input.month);q.set('view','monthly');q.set('basis','beijing');}else q.set('view','current');redirect(`/${locale}/operations/funds?${q}`);
}
