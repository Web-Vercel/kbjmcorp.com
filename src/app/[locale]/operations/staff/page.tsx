import OperationsWorkspace from '@/components/operations/OperationsWorkspace';
export const dynamic='force-dynamic';
export const metadata={title:'人员职责 | 智点未来',robots:{index:false,follow:false}};
export default function Page(props:{params:Promise<{locale:string}>;searchParams:Promise<{ticket?:string;company?:string;month?:string}>}){return <OperationsWorkspace {...props} view="staff"/>;}
