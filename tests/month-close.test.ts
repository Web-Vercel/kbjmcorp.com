import {expect,it} from 'vitest';
import {closeAction,type CloseAccount} from '@/lib/operations/month-close';
const account={binding_id:'binding-test',account_id:'adacct_test',stage:'source_needed',coverage_prepared_by_me:false,draft_prepared_by_me:false} as CloseAccount;
const owner={owner:true,canPrepare:true,canReview:true};
it('preserves company/month and pins the intended advertiser when collecting',()=>{
 const action=closeAction(account,owner,'zh','company-test','2026-10')!;
 const url=new URL(action.href,'https://example.test');expect(url.pathname).toBe('/zh/operations/ads-reporting');expect(Object.fromEntries(url.searchParams)).toEqual({company:'company-test',month:'2026-10',account:'adacct_test'});expect(action.allowed).toBe(true);
 expect(closeAction(account,{owner:false,canPrepare:true,canReview:false},'zh','company-test','2026-10')!.allowed).toBe(false);
});
it('never offers self-review even to an administrator and never advances an open month',()=>{
 for(const [stage,flag] of [['coverage_review_needed','coverage_prepared_by_me'],['settlement_review_needed','draft_prepared_by_me']] as const){expect(closeAction({...account,stage,[flag]:true},owner,'zh','org','2026-10')!.allowed).toBe(false);expect(closeAction({...account,stage},owner,'zh','org','2026-10')!.allowed).toBe(true);}
 expect(closeAction({...account,stage:'month_open'},owner,'zh','org','2026-10')!.allowed).toBe(false);
});
it('carries binding into quotes and limits publication to the administrator',()=>{
 expect(closeAction({...account,stage:'quote_needed'},owner,'zh','org','2026-10')!.href).toContain('binding=binding-test');
 expect(closeAction({...account,stage:'publication_ready'},{owner:false,canPrepare:false,canReview:true},'zh','org','2026-10')!.allowed).toBe(false);
});
