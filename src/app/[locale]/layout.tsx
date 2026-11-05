import "../globals.css";
import { notFound } from "next/navigation";
export default async function LocaleLayout({children, params}: {children: React.ReactNode; params: Promise<{locale:string}>}) { const {locale}=await params; if(locale!=="zh"&&locale!=="en") notFound(); return <html lang={locale==="zh"?"zh-CN":"en"}><body>{children}</body></html>; }
