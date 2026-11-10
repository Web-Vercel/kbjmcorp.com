import {it,expect} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadBilling} from '@/lib/billing/data';
const id='b0000000-0000-4000-8000-000000000001',wallet='b0000000-0000-4000-8000-000000000002';
function client(summaryError=false){return {rpc:async(name:string)=>name==='get_client_wallets'?{data:[{id:wallet,organization_id:id,currency:'CNY'}],error:null}:{data:null,error:summaryError?{code:'42883'}:null},from:(table:string)=>{const q={select:()=>q,in:()=>q,order:()=>q,limit:async()=>({error:null,data:table==='wallet_entries'?[{id,wallet_id:wallet,kind:'ad_spend',amount_minor:-55000,description:'Published statement charge',posted_at:'2026-11-01T00:00:00Z',source_reference:'monthly-statement:'+id}]:[]})};return q;}} as unknown as SupabaseClient;}
it('projects statement links but strips internal ledger source references',async()=>{const data=await loadBilling(client(true));expect(data.error).toBe(false);expect(data.entries[0].statement_id).toBe(id);expect(data.entries[0].amount_minor).toBe('-55000');expect(data.entries[0]).not.toHaveProperty('source_reference');expect(data.statementError).toBe(true);});
