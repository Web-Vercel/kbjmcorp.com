// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {monthClosure,monthCloseChecklistCsv} from '@/lib/operations/month-close-checklist';
import {checklist,org,binding} from './fixtures/month-close-checklist';
import Download from '@/components/operations/MonthCloseChecklistDownload';
const scope={organizationId:org,month:'2024-01-01'};
function closed(){const s=checklist();s.accounts[0]={...s.accounts[0],confirmation_count:1,last_confirmed_at:'2024-02-02T00:00:00Z',verified_cad_minor:'11000'};return s;}
afterEach(cleanup);
it('requires publication, client acknowledgement and full CAD allocation across every account',()=>{
 const s=closed();expect(monthClosure(s,scope).state).toBe('complete');
 for(const change of [{confirmation_count:0,last_confirmed_at:null},{verified_cad_minor:'10000'},{pending_cad_minor:'1'},{reversal_pending:true}])expect(monthClosure({...s,accounts:[{...s.accounts[0],...change}]},scope).state).toBe('pending');
 const pending={...s.accounts[0],binding_id:'b0000000-0000-4000-8000-000000000099',stage:'source_needed',source_id:null,source_ready:false,draft_id:null,draft_total_cny_minor:null,statement_id:null,posted_total_cny_minor:null,published_at:null,confirmation_count:null,last_confirmed_at:null,procurement_cad_minor:null,verified_cad_minor:null,pending_cad_minor:null,reversal_pending:null};
 expect(monthClosure({...s,accounts:[s.accounts[0],pending]},scope)).toMatchObject({state:'pending',accounts:2,published:1});
});
it('separates completed financial records from unresolved billing follow-up and reopens dynamically',()=>{
 const s=closed();const q={total_count:2,open_count:1,in_progress_count:1,resolved_count:0};expect(monthClosure({...s,questions:q},scope)).toMatchObject({state:'followup',unresolved:2});
 expect(monthClosure({...s,questions:{total_count:2,open_count:0,in_progress_count:0,resolved_count:2}},scope).state).toBe('complete');
 expect(monthClosure({...s,questions:{...q,in_progress_count:0,resolved_count:1}},scope).state).toBe('followup');
 // A new unallocated prepayment is not a charge or a month-specific blocker.
 expect(monthClosure({...s,pending_receipt_count:1,pending_receipt_minor:'10000'},scope).state).toBe('complete');
});
it('refuses incomplete, duplicate, inconsistent or wrong-scope evidence rather than inferring zero',()=>{
 const s=closed();for(const input of [null,{...s,accounts:[]},{...s,accounts:[s.accounts[0],s.accounts[0]]},{...s,questions:{...s.questions,total_count:1}},{...s,accounts:[{...s.accounts[0],procurement_cad_minor:null}]},{...s,accounts:[{...s.accounts[0],verified_cad_minor:'11001'}]}])expect(monthClosure(input,scope).state).toBe('unknown');
 expect(monthClosure(s,{...scope,month:'2024-02-01'}).state).toBe('unknown');expect(monthClosure(s,{...scope,organizationId:binding}).state).toBe('unknown');
});
it('keeps page and CSV verdicts consistent without writes, private FX or a new close approval',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const s=closed();for(const locale of ['zh','en'] as const){render(<Download report={s} locale={locale}/>);expect(screen.getByRole('status').textContent).toBe(locale==='zh'?'本月系统记录已闭环':'Monthly system records complete');expect(monthCloseChecklistCsv(s,locale==='zh')).toContain(screen.getByRole('status').textContent!);cleanup();}
 render(<Download report={null} locale="zh"/>);expect(screen.getByRole('status').textContent).toBe('闭环状态待核实');expect(fetcher).not.toHaveBeenCalled();vi.unstubAllGlobals();
});
