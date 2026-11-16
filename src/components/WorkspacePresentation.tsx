"use client";
import SessionSync from './session/SessionSync';
import {usePathname} from 'next/navigation';
import styles from './WorkspacePresentation.module.css';

/** Presentation and session-view synchronization. Authorization remains in the existing guards/forms. */
export default function WorkspacePresentation({children,userId,email}:{children:React.ReactNode;userId?:string;email?:string}){
 const path=usePathname();
 if(path.endsWith('/login'))return <>{children}</>;
 return <div className={styles.workspace}><SessionSync userId={userId} email={email}/>{children}</div>;
}
