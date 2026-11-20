'use client';
import {isValidElement,type ReactNode} from 'react';
import Selector from '@/components/partners/RefundRecordSelector';
export default function RecordPicker({items,label,locale,hashPrefix='record-',appearance='request'}:{appearance?:'account'|'request';items?:{id:string;label:string;active?:boolean;anchorIds?:string[];content:ReactNode}[];label:string;locale:'zh'|'en';hashPrefix?:string}){
 return <Selector items={(items??[]).map(i=>({...i,active:i.active??false,anchorIds:[...(i.anchorIds??[]),...(isValidElement<{id?:string}>(i.content)&&i.content.props.id?[i.content.props.id]:[])]}))} appearance={appearance} label={label} locale={locale} hashPrefix={hashPrefix} emptyText={locale==='zh'?'暂无记录。':'No records.'}/>;
}
