'use client';
import {useId,useState,type InputHTMLAttributes} from 'react';
import styles from './PasswordInput.module.css';
export default function PasswordInput({locale='zh',...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'> & {locale?:'zh'|'en'}){
 const [visible,setVisible]=useState(false),generated=useId(),id=props.id||generated,zh=locale==='zh';
 const label=visible?(zh?'隐藏密码':'Hide password'):(zh?'显示密码':'Show password');
 return <span className={styles.field}><input {...props} id={id} type={visible?'text':'password'} style={{...props.style,paddingRight:'3.25rem'}}/><button type="button" className={styles.toggle} disabled={props.disabled} aria-label={label} title={label} aria-controls={id} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="m3 3 18 18"/>}</svg></button></span>;
}
