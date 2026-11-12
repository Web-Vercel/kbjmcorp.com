import {notFound} from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import PartnerModelsDetail from '@/components/PartnerModelsDetail';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;return {title:locale==='en'?'Partnership models | 智点未来':'合作模式 | 智点未来'};}
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <><SiteHeader locale={locale} path="/partners"/><main id="main"><PartnerModelsDetail locale={locale}/></main><SiteFooter locale={locale}/></>}
