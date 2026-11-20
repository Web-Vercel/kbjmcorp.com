'use client';
import {useContext,useEffect,useId} from 'react';
import {RecordSwitchContext} from '@/components/partners/RefundRecordSelector';
export function useRecordSwitchLock(locked:boolean){const update=useContext(RecordSwitchContext),id=useId();useEffect(()=>{update?.(id,locked);return()=>update?.(id,false);},[update,id,locked]);}
