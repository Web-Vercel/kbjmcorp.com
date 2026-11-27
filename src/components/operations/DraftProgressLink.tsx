'use client';
import Link from 'next/link';
import {useEffect,type ReactNode} from 'react';
export function revealDraft(id:string){
 const target=document.getElementById('draft-'+id);if(!target)return false;
 for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
 requestAnimationFrame(()=>{target.scrollIntoView({behavior:'smooth',block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});});
 return true;
}
export function DraftProgressTarget({id}:{id:string}){useEffect(()=>{revealDraft(id);},[id]);return null;}
export default function DraftProgressLink({href,id,children}:{href:string;id:string;children:ReactNode}){
 return <Link className="service-link" href={href} onClick={event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
  const url=new URL(href,window.location.href);
  if(url.pathname===window.location.pathname&&url.search===window.location.search&&revealDraft(id))event.preventDefault();
 }}>{children}</Link>;
}
