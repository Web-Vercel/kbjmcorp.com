'use client';
import CompanyPageBrand from '@/components/CompanyPageBrand';
export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <html lang="zh-CN"><body style={{margin:0,fontFamily:'Arial, sans-serif',color:'#172b29'}}><CompanyPageBrand locale="zh"/><main style={{padding:32,textAlign:'center'}}><h1>页面暂时不可用</h1><p>This page is temporarily unavailable.</p><button type="button" onClick={reset}>重新加载 / Retry</button></main></body></html>}
