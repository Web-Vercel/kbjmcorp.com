import {currencyUnits} from '@/lib/money-display';
import {investorLabels} from './investor-labels';
export function investorCell(key:string,value:string|null|undefined){
 if(value===null||value===undefined)return '—';
 if(/^-?\d+$/.test(value)&&/_(minor|micros)$/.test(key))return currencyUnits(value,key.endsWith('_micros')?6:2);
 return value;
}
export function investorColumn(key:string,locale:'zh'|'en'){
 if(locale==='en')return /_(minor|micros)$/.test(key)?key.replace(/_(minor|micros)$/,'')+' (currency units)':key;
 return (investorLabels[key]||key).replace('（最小货币单位）','（原币）').replace('（百万分之一原币）','（原币）').replace('（加币分）','（CAD）').replace('（人民币分）','（CNY）').replace('（分）','（原币）');
}
