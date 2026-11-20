import type {Locale} from '@/lib/content';
import {opsStatus} from '@/lib/operations/model';
import styles from './ServiceStatus.module.css';
export default function ServiceStatus({status,locale}:{status:string;locale:Locale}){
 const known=['open','in_progress','resolved'].includes(status);
 const label=known?opsStatus(status,locale):(locale==='zh'?'状态待核查':'Status unconfirmed');
 return <span className={styles.status} data-service-status={known?status:'unknown'} aria-label={`${locale==='zh'?'工单状态：':'Request status: '}${label}`}><span className={styles.dot} aria-hidden="true"/>{label}</span>;
}
