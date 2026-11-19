// @vitest-environment jsdom
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import type {SupabaseClient} from '@supabase/supabase-js';
import Workspace from '@/components/partners/RefundWorkspace';
const id=(n:number)=>`c0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
afterEach(()=>{cleanup();window.history.replaceState(null,'','#');});
it('shows one wallet and only its refunds, while retaining every permitted account as an option',async()=>{
 const wallets=[{id:id(1),name:'COMPANY A',balance_minor:'0',held_minor:'0',available_minor:'0'},{id:id(2),name:'COMPANY B',balance_minor:'70323',held_minor:'2000',available_minor:'68323'}].map(w=>({...w,organization_id:w.id,currency:'CNY',can_request:false,policy:null}));
 const refunds=wallets.map(w=>({id:id(w.id===id(1)?11:12),wallet_id:w.id,organization_id:w.id,company:w.name,gross_minor:'2000',fee_minor:'100',net_minor:'1900',policy_snapshot:{mode:'fixed',value:100,agreement:'TEST'},reason:'TEST ONLY '+w.name,status:'requested',review_note:null,assessment:null,prepared_by_me:null,requested_by_me:false,created_at:'2026-11-18T23:00:00Z',paid_at:null}));
 const client={rpc:async()=>({data:{staff:false,owner:false,wallets,refunds,payments:[]},error:null})} as unknown as SupabaseClient;
 render(await Workspace({client,locale:'zh'}));const select=screen.getByRole('combobox',{name:'选择客户资金账户'});
 expect((select as HTMLSelectElement).value).toBe(id(2));expect(screen.getByText('CNY 703.23')).toBeTruthy();expect(screen.queryByText('TEST ONLY COMPANY A')).toBeNull();expect(screen.getByText('TEST ONLY COMPANY B')).toBeTruthy();
 fireEvent.change(select,{target:{value:id(1)}});expect(screen.queryByText('CNY 703.23')).toBeNull();expect(screen.getByText('TEST ONLY COMPANY A')).toBeTruthy();expect(screen.queryByText('TEST ONLY COMPANY B')).toBeNull();
});
