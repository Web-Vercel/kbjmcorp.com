// @vitest-environment jsdom
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/components/SignOutButton',()=>({default:()=> <button>退出登录</button>}));
import StaffIdentityBar from '@/components/admin/StaffIdentityBar';
import type {OpsContext} from '@/lib/operations/model';
const ctx=(roles:OpsContext['roles']):OpsContext=>({owner:false,roles,canSource:false,canPrepare:false,canReview:false,canSupport:false});
afterEach(cleanup);
it.each([['finance_preparer','中国财务制单'],['finance_reviewer','中国财务复核']])('identifies %s from verified context', (role,label)=>{render(<StaffIdentityBar locale="zh" email="staff@example.invalid" role="operator" context={ctx([{unit:'zhidian_cn',role}])}/>);expect(screen.getByText(/staff@example.invalid/)).toBeTruthy();expect(screen.getByText(new RegExp(label))).toBeTruthy();expect(screen.getByText(/中国智点未来/)).toBeTruthy();expect(screen.getByRole('button',{name:'退出登录'})).toBeTruthy();});
it('does not infer administrator employment from cross-unit access',()=>{render(<StaffIdentityBar locale="zh" email="admin@example.invalid" role="admin" context={ctx([])}/>);expect(screen.getByText('身份：管理员')).toBeTruthy();expect(screen.getByText(/不表示任职归属/)).toBeTruthy();});
it('reports lookup failure rather than inventing a responsibility',()=>{render(<StaffIdentityBar locale="zh" role="operator" context={null}/>);expect(screen.getByText(/职责信息暂不可用/)).toBeTruthy();expect(screen.queryByText(/财务复核/)).toBeNull();});
it('shows all assigned roles and supports English',()=>{render(<StaffIdentityBar locale="en" email="staff@example.invalid" role="operator" context={ctx([{unit:'zhidian_cn',role:'finance_preparer'},{unit:'zhidian_cn',role:'finance_reviewer'}])}/>);expect(screen.getByText(/China finance preparer \/ China finance reviewer/)).toBeTruthy();expect(screen.getByText('Operating unit: Zhidian China')).toBeTruthy();});
