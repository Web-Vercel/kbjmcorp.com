'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export default function OperationsLegacyLinks({locale}:{locale:string}){
 const router=useRouter();
 useEffect(()=>{const navigate=()=>{const route:Record<string,string>={'#handoff':'manual-sources','#finance':'fund-summary','#requests':'service-requests','#roles':'staff'};const target=route[window.location.hash];if(target)router.replace(`/${locale}/operations/${target}`);};navigate();window.addEventListener('hashchange',navigate);return()=>window.removeEventListener('hashchange',navigate);},[locale,router]);
 return null;
}
