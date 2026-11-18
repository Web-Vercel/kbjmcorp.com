import {clickThroughRate} from '@/lib/ads/display-metrics';
import styles from './StatementPerformance.module.css';
import type {ClientStatement} from '@/lib/billing/client-statement';
export default function StatementPerformance({statement:s,zh}:{statement:ClientStatement;zh:boolean}){const ctr=clickThroughRate(s.usage.impressions,s.usage.clicks);return <section><h3>{zh?'投放表现':'Performance'}</h3><dl className={styles.metrics}>{[[zh?'展示次数':'Impressions',String(s.usage.impressions)],[zh?'点击次数':'Clicks',String(s.usage.clicks)],[zh?'点击率':'Click-through rate',ctr]].map(([label,value])=><div key={label}><dt>{label}</dt><dd data-workspace-value>{value}</dd></div>)}</dl></section>}
