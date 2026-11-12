import './globals.css';
import Link from 'next/link';
import CompanyPageBrand from '@/components/CompanyPageBrand';
export const metadata={title:'页面未找到 | 智点未来',robots:{index:false,follow:false}};
export default function GlobalNotFound(){return <html lang="zh-CN"><body><CompanyPageBrand locale="zh"/><main className="wrap section" style={{minHeight:'65vh',display:'grid',placeItems:'center',textAlign:'center'}}><section><h1 style={{fontSize:42,letterSpacing:0}}>404</h1><p>页面未找到 / Page not found</p><Link className="button" href="/zh">返回首页 / Home</Link></section></main></body></html>}
