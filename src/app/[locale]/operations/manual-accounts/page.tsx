import OperationsWorkspace from '@/components/operations/OperationsWorkspace';
export const dynamic='force-dynamic';
export const metadata={title:'手工关联广告账户 | 智点未来',robots:{index:false,follow:false}};
export default function Page(props:{params:Promise<{locale:string}>;searchParams:Promise<{ticket?:string;company?:string;month?:string}>}){return <OperationsWorkspace {...props} view="manual-accounts"/>;}
