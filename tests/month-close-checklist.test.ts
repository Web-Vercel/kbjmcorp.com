import {it,expect} from 'vitest';
import {buildMonthCloseChecklist,monthCloseChecklistCsv} from '@/lib/operations/month-close-checklist';
import {checklistInput,checklist,bill,org} from './fixtures/month-close-checklist';
it('keeps exact amounts and pending statuses, separates currencies and strips private fields before client serialization',()=>{
 const report=checklist();expect(report).not.toBeNull();expect(JSON.stringify(report)).not.toContain('PRIVATE');const csv=monthCloseChecklistCsv(report,true);expect(csv).toContain('90071992547409.93');expect(csv).toContain('605.00');expect(csv).toContain('110.00');expect(csv).toContain("'=FICTIONAL COMPANY()");expect(csv).toContain("'=FICTIONAL ACCOUNT()");expect(csv).toContain('不是客户账单');expect(csv).toContain('CNY与CAD分列');expect(csv).toContain('不会自动更新');expect(csv).not.toContain('PRIVATE');
});
it('refuses missing, scoped incorrectly or truncated inputs instead of exporting zero or incomplete statuses',()=>{
 expect(buildMonthCloseChecklist({...checklistInput(),questions:null})).toBeNull();expect(buildMonthCloseChecklist({...checklistInput(),organizationId:'b0000000-0000-4000-8000-000000000009'})).toBeNull();expect(buildMonthCloseChecklist({...checklistInput(),month:'2024-02-01'})).toBeNull();
 const data=checklistInput();data.payments.payment_count=101;expect(buildMonthCloseChecklist(data)).toBeNull();data.payments.payment_count=0;data.reads.statement_count=201;expect(buildMonthCloseChecklist(data)).toBeNull();
});
it('requires coherent published statement identities and amounts, while allowing unpublished pending work',()=>{
 let data=checklistInput();data.overview.accounts[0].draft_total_cny_minor='1';expect(buildMonthCloseChecklist(data)).toBeNull();data=checklistInput();data.overview.accounts.push({...data.overview.accounts[0]});expect(buildMonthCloseChecklist(data)).toBeNull();
 const pending={...checklistInput(),overview:{...checklistInput().overview,wallet_id:null,accounts:[{...checklistInput().overview.accounts[0],stage:'source_needed',draft_id:null,draft_total_cny_minor:null,statement_id:null,posted_total_cny_minor:null,published_at:null,source_id:null,source_ready:false}]},payments:null,reads:null};const report=buildMonthCloseChecklist(pending);expect(report).not.toBeNull();expect(report!.balance_minor).toBeNull();expect(report!.accounts[0].confirmation_count).toBeNull();expect(report!.accounts[0].procurement_cad_minor).toBeNull();expect(monthCloseChecklistCsv(report!,true)).toContain('尚未读取该月完整来源');expect(monthCloseChecklistCsv(report!,true)).toContain('尚未开户');
});

it('reconciles CAD allocation totals and retains a pending reversal without serializing receipt evidence',()=>{
 const input=checklistInput();const payment={id:org,revision:1,bank_reference:'PRIVATE BANK',received_on:'2024-02-01',received_cad_minor:'11000',evidence_reference:'PRIVATE EVIDENCE',evidence_sha256:'a'.repeat(64),note:'PRIVATE NOTE',prepared_by:org,prepared_at:'2024-02-01T00:00:00Z',status:'approved',review_note:'PRIVATE REVIEW',reviewed_at:'2024-02-01T01:00:00Z',reversal_pending:true,allocations:[{statement_id:bill,amount_cad_minor:'11000',month:'2024-01-01',account_name:'FICTIONAL'}]};
 const payments={...input.payments,payment_count:1,payments:[payment]};expect(buildMonthCloseChecklist({...input,payments})).toBeNull();
 payments.statements=[{...payments.statements[0],verified_cad_minor:'11000'}];const report=buildMonthCloseChecklist({...input,payments});expect(report).not.toBeNull();expect(report!.accounts[0].reversal_pending).toBe(true);expect(JSON.stringify(report)).not.toContain('PRIVATE');
});
