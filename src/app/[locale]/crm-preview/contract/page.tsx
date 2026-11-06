import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContractDocument from "@/components/crm/ContractDocument";
import { contractTemplate } from "@/lib/crm/contract-template";
export const metadata:Metadata={title:'合同草稿演示 | 智点未来',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/crm-preview/contract"/><main id="main" className="section wrap"><Link className="service-link contract-back" href={`/${locale}/crm-preview`}>← {locale==='zh'?'CRM演示':'CRM demo'}</Link><ContractDocument locale={locale} demo contract={{id:'DEMO-DRAFT-001',organization_id:'fictional-company',template_version:'agency-draft-v1',template_body:contractTemplate,title:'广告代理服务协议 · 示范草稿',client_legal_name:'演示客户 · 星禾家居（虚构主体）',provider_legal_name:'演示服务方（非已核实签约主体）',service_scope:'示例：广告策略、素材协调、投放管理与中文月报。具体平台权限、交付数量和实施安排须在正式签约前确认。',pricing_terms:'示例：人民币结算，保留平台原币与汇率依据；代理服务费另行约定，未约定不自动收取。此示例不是报价或收款依据。',refund_terms:'示例：未消耗广告余额与已完成服务费分别核对，实际退费及终止安排待双方书面确认；本页不执行退款。',starts_on:'2026-11-01',ends_on:'2027-10-31',status:'draft',client_visible:false,signature_reference:null,signed_on:null,created_at:'2026-11-05T18:00:00Z',updated_at:'2026-11-05T18:00:00Z'}}/></main><SiteFooter locale={locale}/></>;}
