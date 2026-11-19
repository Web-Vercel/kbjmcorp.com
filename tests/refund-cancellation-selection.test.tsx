// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,within,cleanup,waitFor} from '@testing-library/react';
import type {SupabaseClient} from '@supabase/supabase-js';
import Workspace from '@/components/partners/RefundWorkspace';
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('distinguishes two pending applications and sends only the selected ten-yuan ID',async()=>{
 const refunds=[{id:id(20),gross_minor:'2000',net_minor:'1900'},{id:id(10),gross_minor:'1000',net_minor:'900'}].map(r=>({...r,wallet_id:id(1),organization_id:id(2),company:'FICTIONAL COMPANY',fee_minor:'100',policy_snapshot:{mode:'fixed',value:100,agreement:'TEST FEE'},reason:'TEST ONLY',status:'requested',review_note:null,assessment:null,prepared_by_me:null,requested_by_me:true,created_at:'2026-11-18T23:00:00Z',paid_at:null}));
 const client={rpc:async()=>({data:{staff:false,owner:false,wallets:[],refunds,payments:[]},error:null})} as unknown as SupabaseClient;
 const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,receipt:{id:id(10),action:'refund_cancel'}}));vi.stubGlobal('fetch',fetcher);
 const {container}=render(await Workspace({client,locale:'zh'}));
 const selector=screen.getByRole('combobox',{name:'选择退款申请'});expect(within(selector).getByRole('option',{name:/CNY 10.00/})).toBeTruthy();expect(container.querySelector('#refund-'+id(10))).toBeNull();
 fireEvent.change(selector,{target:{value:id(10)}});expect(container.querySelector('#refund-'+id(20))).toBeNull();
 const card=container.querySelector('#refund-'+id(10))! as HTMLElement;fireEvent.click(within(card).getByText('取消这笔 CNY 10.00 申请'));
 fireEvent.click(within(card).getByRole('checkbox'));fireEvent.change(within(card).getByLabelText('取消 CNY 10.00 申请的原因'),{target:{value:'TEST cancel ten only'}});
 fireEvent.click(within(card).getByRole('button',{name:'确认取消 CNY 10.00 申请'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({id:id(10),action:'refund_cancel'});
 vi.spyOn(window,'confirm').mockReturnValue(true);fireEvent.change(selector,{target:{value:id(20)}});expect(container.querySelector('#refund-'+id(10))).toBeNull();expect(container.querySelector('#refund-'+id(20))).toBeTruthy();expect(screen.queryByText('TEST cancel ten only')).toBeNull();vi.restoreAllMocks();
});
