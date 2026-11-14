"use client";
import {usePathname} from 'next/navigation';
import styles from './WorkspacePresentation.module.css';

/** Presentation only. Authentication and business actions remain in their existing guards/forms. */
export default function WorkspacePresentation({children}:{children:React.ReactNode}){
 const path=usePathname();
 if(path.endsWith('/login'))return <>{children}</>;
 return <div className={styles.workspace}>{children}</div>;
}
