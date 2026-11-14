'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export default function ClientRecordLegacyLinks(){
 const router=useRouter();
 useEffect(()=>{const navigate=()=>{const view=window.location.hash.slice(1);if(!['profile','contacts','access','contracts','finance'].includes(view))return;const url=new URL(window.location.href);url.searchParams.set('view',view);url.hash='';router.replace(url.pathname+url.search);};navigate();window.addEventListener('hashchange',navigate);return()=>window.removeEventListener('hashchange',navigate);},[router]);
 return null;
}
