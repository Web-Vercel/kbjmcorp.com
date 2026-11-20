"use client";
import SessionSync from './session/SessionSync';
import IdleSession from './session/IdleSession';
import GuideAssistant from './session/GuideAssistant';
import {usePathname} from 'next/navigation';
import styles from './WorkspacePresentation.module.css';

/** Presentation and session-view synchronization. Authorization remains in the existing guards/forms. */
export default function WorkspacePresentation({children,userId,email}:{children:React.ReactNode;userId?:string;email?:string}){
 const path=usePathname();
 const locale=path.split('/')[1]==='en'?'en':'zh';
 const internal=/^\/(zh|en)\/(admin|operations)(\/|$)/.test(path);
 if(path.endsWith('/login'))return <>{children}</>;
 return <div className={styles.workspace}><SessionSync userId={userId} email={email}/>{userId&&<IdleSession key={userId} userId={userId} locale={locale} internal={internal}/>} {children}{userId&&<GuideAssistant locale={locale} internal={internal}/>}</div>;
}
