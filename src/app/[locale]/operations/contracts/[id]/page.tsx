import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperations } from "@/lib/operations/server";
import { contractColumns,type ClientContract } from "@/lib/crm/contracts";
import ContractDocument from "@/components/crm/ContractDocument";
export const dynamic='force-dynamic';export const metadata:Metadata={title:'财务合同依据 | 智点未来',robots:{index:false,follow:false}};
export default async function Contract({params}:{params:Promise<{locale:string;id:string}>}){const {locale,id}=await params;if(locale!=='zh'&&locale!=='en')notFound();const {client,context}=await requireOperations(locale);if(!z.uuid().safeParse(id).success||!context||!(context.owner||context.canPrepare||context.canReview))notFound();const result=await client.from('client_contracts').select(contractColumns).eq('id',id).maybeSingle();if(!result.error&&!result.data)notFound();return <main className="section wrap"><Link className="contract-back service-link" href={`/${locale}/operations`}>← {locale==='zh'?'返回三方运营中心':'Operations'}</Link>{result.error?<p className="admin-error">{locale==='zh'?'合同依据暂不可用。':'Contract evidence unavailable.'}</p>:<ContractDocument locale={locale} contract={result.data as ClientContract}/>}</main>;}
