'use client';
import {useState} from 'react';
import type {AgencyFeeRule} from '@/lib/billing/agency-fees';
import {minorInput} from '@/lib/billing/quote-snapshot';
import styles from './AgencyQuoteCalculator.module.css';
export default function QuoteFeeFields({prefix,zh,seed}:{prefix:'ca'|'cn';zh:boolean;seed?:AgencyFeeRule}){
 const [mode,setMode]=useState(seed?.mode||'percentage');
 const [values,setValues]=useState({percent:String((seed?.basisPoints??(prefix==='ca'?1500:2000))/100),fixed:minorInput(seed?.fixedMinor||'0'),minimum:minorInput(seed?.minimumMinor||'0')});
 const fields=[['percent',zh?'比例（%，未约定填0）':'Percentage (0 if not agreed)'],['fixed',zh?'固定月费':'Fixed monthly fee'],['minimum',zh?'最低月费':'Minimum monthly fee']] as const;
 const active=(key:string)=>key==='percent'?mode!=='fixed':key==='fixed'?mode==='fixed':mode==='greater_of';
 const input=([key,label]:typeof fields[number])=><label key={key}>{label}<input name={prefix+key} value={values[key]} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} required inputMode="decimal"/></label>;
 return <fieldset className={styles.card}><legend>{prefix==='ca'?(zh?'加拿大 KBJM 服务费（CAD）':'KBJM Canada fee (CAD)'):(zh?'中国智点未来服务费（CNY）':'China operator fee (CNY)')}</legend><label>{zh?'收费方式':'Fee method'}<select name={prefix+'mode'} value={mode} onChange={e=>setMode(e.target.value as AgencyFeeRule['mode'])}><option value="percentage">{zh?'按比例':'Percentage'}</option><option value="fixed">{zh?'固定月费':'Fixed monthly fee'}</option><option value="greater_of">{zh?'比例与最低月费取较高者':'Greater of percentage or monthly minimum'}</option></select></label>{prefix==='cn'&&<label>{zh?'中国服务费计算基数':'China fee basis'}<select name="basis" defaultValue={seed?.basis??'upstream_total'}><option value="platform_ad_spend">{zh?'仅人民币广告成本':'Converted platform cost only'}</option><option value="upstream_total">{zh?'含加拿大服务费的上游采购额':'Upstream total including Canada fee'}</option></select></label>}<div className={styles.grid}>{fields.filter(([key])=>active(key)).map(input)}</div><details><summary>{zh?'更多设置':'More settings'}</summary><label>{zh?'计费基数为零时':'When the fee basis is zero'}<select name={prefix+'waive'} defaultValue={seed?.waiveWhenZero===false?'no':'yes'}><option value="yes">{zh?'不收此层服务费':'Waive this fee'}</option><option value="no">{zh?'仍按所选规则计算':'Apply the selected rule'}</option></select></label><p>{zh?'以下参数保留，当前收费方式不使用。':'Retained parameters below are unused by the current fee method.'}</p><div className={styles.grid}>{fields.filter(([key])=>!active(key)).map(input)}</div></details></fieldset>;
}
