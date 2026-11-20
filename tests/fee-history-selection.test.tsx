// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import type {SupabaseClient} from '@supabase/supabase-js';
import History from '@/components/partners/SavedPartnerHistory';
const id='d0000000-0000-4000-8000-000000000001',old='d0000000-0000-4000-8000-000000000002';
afterEach(()=>{cleanup();window.history.replaceState(null,'','#');});
it('keeps former agreements accessible by selection without showing two versions together or writing data',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:{notes:[],policies:[{id,wallet_id:id,mode:'fixed',value:100,agreement:'CURRENT AGREEMENT',active:true,created_at:'2026-11-18'},{id:old,wallet_id:id,mode:'percent',value:250,agreement:'PREVIOUS AGREEMENT',active:false,created_at:'2026-11-17'}],notes_limit:1000,policies_limit:1000},error:null});
 render(await History({client:{rpc} as unknown as SupabaseClient,records:[{id,label:'TEST WALLET'}]}));fireEvent.click(screen.getByText('查看已保存的手续费规则版本'));
 const select=screen.getByRole('combobox',{name:'选择手续费版本'});expect(screen.getByText('CURRENT AGREEMENT')).toBeTruthy();expect(screen.queryByText('PREVIOUS AGREEMENT')).toBeNull();fireEvent.change(select,{target:{value:old}});expect(screen.getByText('PREVIOUS AGREEMENT')).toBeTruthy();expect(screen.getByText('申请金额的 2.5%')).toBeTruthy();expect(screen.queryByText('CURRENT AGREEMENT')).toBeNull();expect(rpc).toHaveBeenCalledOnce();expect(rpc).toHaveBeenCalledWith('read_saved_partner_history',{p_ids:[id]});
});
