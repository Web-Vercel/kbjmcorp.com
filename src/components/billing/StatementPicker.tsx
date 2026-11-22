'use client';
import {useRouter} from 'next/navigation';
export default function StatementPicker({locale,wallet,month,months,statement,statements}:{locale:string;wallet:string;month:string;months:string[];statement:string;statements:{id:string;label:string}[]}){
 const router=useRouter(),zh=locale==='zh';
 function choose(key:'wallet'|'month'|'statement',value:string){const q=new URLSearchParams();if(key==='wallet'){if(value)q.set('wallet',value);}else {if(wallet)q.set('wallet',wallet);if(key==='month'){if(value)q.set('month',value);}else{if(month)q.set('month',month);q.set('statement',value);}}router.push(`/${locale}/account/statements${q.size?'?'+q:''}`);}
 return <div className="admin-filter"><label>{zh?'结算月份':'Settlement month'}<select aria-label={zh?'结算月份':'Settlement month'} value={month} onChange={e=>choose('month',e.target.value)}>{months.map(m=><option key={m} value={m}>{zh?`${m.slice(0,4)}年${Number(m.slice(5))}月`:m}</option>)}</select></label>{statements.length>1&&<label>{zh?'广告账户／账单':'Ad account / statement'}<select value={statement} onChange={e=>choose('statement',e.target.value)}>{statements.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}</div>;
}
