import {it,expect} from 'vitest';
import {monthCloseOverview} from '@/lib/operations/month-close-overview';
const id='b0000000-0000-4000-8000-000000000001',other='c0000000-0000-4000-8000-000000000001';
const scope={organizationId:id,month:'2026-10-01'};
const a={binding_id:id,account_id:'adacct_fictional',account_label:'FICTIONAL',active:true,timezone:null,stage:'source_needed',source_id:null,source_ready:false,coverage_reason:null,coverage_kind:null,source_cad_minor:null,operational_source_count:0,quote_match_count:0,coverage_prepared_by_me:false,draft_id:null,draft_prepared_by_me:false,draft_total_cny_minor:null,newer_shared_source:false,statement_id:null,published_at:null,posted_total_cny_minor:null};
const data={organization_id:id,month:'2026-10-01',wallet_id:null,balance_minor:'0',pending_receipt_count:0,pending_receipt_minor:'0',accounts:[a]};
it('accepts an unprepared month and projects out unknown internal fields without inventing completion',()=>{
 expect(monthCloseOverview({...data,secret:'PRIVATE'},scope)).toEqual(data);expect(monthCloseOverview({...data,accounts:[]},scope)?.accounts).toEqual([]);
});
it('retains exact large or negative minor-unit balances and rejects malformed money',()=>{
 for(const amount of ['900719925474099300','-900719925474099300'])expect(monthCloseOverview({...data,balance_minor:amount},scope)?.balance_minor).toBe(amount);
 for(const balance_minor of [1,'1.00','NaN','1e8',' 2'])expect(monthCloseOverview({...data,balance_minor},scope)).toBeNull();
});
it('rejects a different company/month, unknown stage or duplicate binding/account/draft/statement identity',()=>{
 expect(monthCloseOverview({...data,organization_id:other},scope)).toBeNull();expect(monthCloseOverview({...data,month:'2026-09-01'},scope)).toBeNull();
 expect(monthCloseOverview({...data,accounts:[{...a,stage:'unknown'}]},scope)).toBeNull();expect(monthCloseOverview({...data,accounts:[a,a]},scope)).toBeNull();
 expect(monthCloseOverview({...data,accounts:[a,{...a,binding_id:other}]},scope)).toBeNull();
 const draft={...a,draft_id:id,draft_total_cny_minor:'100'};expect(monthCloseOverview({...data,accounts:[draft,{...draft,binding_id:other,account_id:'adacct_other'}]},scope)).toBeNull();
});
it('rejects incomplete or contradictory publication receipts and source-ready flags',()=>{
 const posted={...a,stage:'published',draft_id:id,draft_total_cny_minor:'100',statement_id:other,published_at:'2026-11-01T00:00:00Z',posted_total_cny_minor:'100'};
 expect(monthCloseOverview({...data,accounts:[posted]},scope)).not.toBeNull();
 for(const fields of [{statement_id:null},{published_at:null},{posted_total_cny_minor:'101'},{draft_id:null},{source_ready:true}])expect(monthCloseOverview({...data,accounts:[{...posted,...fields}]},scope)).toBeNull();
 expect(monthCloseOverview({...data,accounts:[{...a,statement_id:other}]},scope)).toBeNull();
});
