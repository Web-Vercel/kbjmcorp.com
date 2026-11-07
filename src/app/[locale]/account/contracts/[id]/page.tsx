import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadClientFinanceScope } from "@/lib/client/finance-scope";
import { requireClientPage } from "@/lib/client/page";
import { contractColumns,type ClientContract } from "@/lib/crm/contracts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContractDocument from "@/components/crm/ContractDocument";
export const dynamic='force-dynamic';export const metadata:Metadata={title:'客户合同 | 智点未来',robots:{index:false,follow:false}};
export default async function Contract({params}:{params:Promise<{locale:string;id:string}>}){const {locale,id}=await params;if(locale!=='zh'&&locale!=='en')notFound();const {client,user}=await requireClientPage(locale);if(!z.uuid().safeParse(id).success)notFound();const scope=await loadClientFinanceScope(client,user.id);const result=scope.error?{data:null,error:true}:scope.ids.length?await client.from('client_contracts').select(contractColumns).eq('id',id).in('organization_id',scope.ids).eq('client_visible',true).neq('status','draft').maybeSingle():{data:null,error:null};if(!result.error&&!result.data)notFound();return <><SiteHeader locale={locale} path="/account/company"/><main id="main" className="wrap section"><Link className="service-link contract-back" href={`/${locale}/account/company`}>← {locale==='zh'?'企业资料与合同':'Company records & contracts'}</Link>{result.error?<p className="admin-error">{locale==='zh'?'合同暂不可用。':'Contract unavailable.'}</p>:<ContractDocument contract={result.data as ClientContract} locale={locale}/>}</main><SiteFooter locale={locale}/></>;}
