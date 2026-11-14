"use client";
import {useEffect,useRef} from 'react';
export default function OperationsSection({title,description,children,open=false}:{title:string;description:string;children:React.ReactNode;open?:boolean}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  const reveal=()=>{const hash=window.location.hash.slice(1);const target=hash?document.getElementById(hash):null;if(target&&ref.current?.contains(target))ref.current.open=true;};
  reveal();window.addEventListener('hashchange',reveal);return()=>window.removeEventListener('hashchange',reveal);
 },[]);
 return <details ref={ref} className="admin-panel" open={open||undefined}><summary><strong>{title}</strong><span style={{display:'block',marginTop:6,color:'#62766a'}}>{description}</span></summary>{children}</details>;
}
