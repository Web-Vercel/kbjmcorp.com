import LegalDocument from '@/components/LegalDocument';
import {legalContent} from '@/lib/legal-content';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return {title:`${legalContent[locale].privacy.title} | 智点未来`};}
export default async function Privacy({params}:Props){const {locale}=await params;if(locale!=='zh'&&locale!=='en')notFound();return <LegalDocument locale={locale} document="privacy"/>;}
