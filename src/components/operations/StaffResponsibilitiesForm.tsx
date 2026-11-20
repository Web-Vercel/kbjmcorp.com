'use client';
import {useState} from 'react';
import AdminForm from '@/components/admin/AdminForm';
import type {OperatingStaff} from '@/lib/operations/staff-label';
import {opsStatus} from '@/lib/operations/model';
type Staff=OperatingStaff&{label:string};
export default function StaffResponsibilitiesForm({locale,staff}:{locale:'zh'|'en';staff:Staff[]}){
 const zh=locale==='zh';
 const [userId,setUserId]=useState(staff[0]?.user_id||'');
 const [selection,setSelection]=useState('');
 const [newRole,setNewRole]=useState('');
 const [active,setActive]=useState('');
 const person=staff.find(s=>s.user_id===userId);
 const assignment=person?.assignments?.find(a=>`${a.unit}:${a.role}`===selection);
 const creating=selection==='new';
 const unit=creating?(newRole==='ad_operations'?'kbjm_ca':newRole?'zhidian_cn':''):assignment?.unit||'';
 const role=creating?newRole:assignment?.role||'';
 if(!staff.length)return <p>{zh?'暂无可调整职责的内部人员。':'No eligible internal staff.'}</p>;
 return <AdminForm locale={locale} endpoint="/api/operations" resetOnSuccess={false} button={zh?'保存内部职责':'Save responsibility'}>
  <input type="hidden" name="action" value="role"/>
  <label>{zh?'已核实的内部操作员':'Verified internal operator'}<select name="userId" required value={userId} onChange={e=>{setUserId(e.target.value);setSelection('');setNewRole('');setActive('');}}>{staff.map(s=><option key={s.user_id} value={s.user_id}>{s.label}</option>)}</select></label>
  <label>{zh?'要调整的职责':'Responsibility to change'}<select required value={selection} onChange={e=>{const value=e.target.value;setSelection(value);setNewRole('');const a=person?.assignments?.find(a=>`${a.unit}:${a.role}`===value);setActive(a?(a.active?'yes':'no'):'');}}><option value="">{zh?'请选择已有职责，或新增职责':'Select an existing responsibility or add one'}</option>{person?.assignments?.map(a=><option key={`${a.unit}:${a.role}`} value={`${a.unit}:${a.role}`}>{a.unit==='kbjm_ca'?'KBJM · Canada':'智点未来 · China'} · {opsStatus(a.role,locale)} · {a.active?(zh?'启用':'Active'):(zh?'已撤销':'Revoked')}</option>)}<option value="new">{zh?'新增职责…':'Add responsibility…'}</option></select></label>
  {creating&&<label>{zh?'新增职责':'New responsibility'}<select required value={newRole} onChange={e=>{setNewRole(e.target.value);setActive('');}}><option value="">{zh?'请选择职责':'Select a responsibility'}</option>{['ad_operations','customer_service','finance_preparer','finance_reviewer'].map(r=><option key={r} value={r}>{opsStatus(r,locale)}</option>)}</select></label>}
  {role&&<p>{zh?'本次调整：':'Changing: '}{unit==='kbjm_ca'?'KBJM · Canada':'智点未来 · China'} · {opsStatus(role,locale)}</p>}
  <input type="hidden" name="unit" value={unit}/><input type="hidden" name="role" value={role}/>
  <label>{zh?'启用状态':'Active'}<select name="active" required value={active} onChange={e=>setActive(e.target.value)} disabled={!role}><option value="">{zh?'请选择':'Select'}</option><option value="yes">{zh?'启用':'Active'}</option><option value="no">{zh?'撤销':'Revoke'}</option></select></label>
  <label className="admin-checkbox"><input key={`${userId}:${selection}:${newRole}:${active}`} type="checkbox" name="confirm" required/>{zh?'我已核实人员身份与该职责的业务授权。':'I verified staff identity and authorization for this responsibility.'}</label>
 </AdminForm>;
}
