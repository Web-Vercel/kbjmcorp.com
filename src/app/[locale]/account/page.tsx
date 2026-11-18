import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
export const dynamic='force-dynamic';
/** Compatibility entry only; the former customer homepage has been retired. */
export default async function Account({params,searchParams}:{params:Promise<{locale:string}>;searchParams?:Promise<{wallet?:string}>}){
 const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();
 const query=await searchParams||{};
 if(query.wallet){if(!z.uuid().safeParse(query.wallet).success)notFound();redirect(`/${locale}/account/transactions?${new URLSearchParams({wallet:query.wallet})}`);}
 redirect(`/${locale}/access`);
}
