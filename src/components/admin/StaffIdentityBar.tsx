import type {Locale} from '@/lib/content';
import type {OpsContext} from '@/lib/operations/model';
import {opsStatus} from '@/lib/operations/model';
import SignOutButton from '@/components/SignOutButton';
export default function StaffIdentityBar({locale,email,role,context}:{locale:Locale;email?:string;role:'admin'|'operator';context:OpsContext|null}){
 const zh=locale==='zh';
 const roles=context?.roles||[];
 const units=[...new Set(roles.map(r=>r.unit))].map(unit=>unit==='kbjm_ca'?(zh?'加拿大 KBJM':'KBJM Canada'):unit==='zhidian_cn'?(zh?'中国智点未来':'Zhidian China'):unit);
 return <aside aria-label={zh?'当前登录身份':'Current signed-in identity'} style={{position:'sticky',top:0,zIndex:30,background:'#f0f6ed',borderBottom:'1px solid #d4e2ce',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap',color:'#124d3c',fontSize:14}}><div style={{display:'grid',gap:6,minWidth:0,overflowWrap:'anywhere'}}><strong>{zh?'当前登录：':'Signed in: '}{email||(zh?'邮箱未提供':'Email unavailable')}</strong><span>{zh?'身份：':'Role: '}{role==='admin'?(zh?'管理员':'Administrator'):(zh?'内部员工':'Staff')}{roles.length>0&&' · '+roles.map(r=>opsStatus(r.role,locale)).join(' / ')}</span><span>{zh?'运营单位：':'Operating unit: '}{context===null?(zh?'职责信息暂不可用':'Responsibilities unavailable'):units.length?units.join(' / '):role==='admin'?(zh?'跨单位管理权限（不表示任职归属）':'Cross-unit administration (not an employment assignment)'):(zh?'尚未分配':'Not assigned')}</span></div><SignOutButton locale={locale} mode="staff"/></aside>;
}
