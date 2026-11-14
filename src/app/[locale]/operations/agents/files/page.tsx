import PartnerWorkspace from '@/components/partners/PartnerWorkspace';
export const dynamic='force-dynamic';
export const metadata={title:'代理业务 | 智点未来',robots:{index:false,follow:false}};
export default function Page({params}:{params:Promise<{locale:string}>}){return <PartnerWorkspace params={params} view='files' internal={true}/>;}
