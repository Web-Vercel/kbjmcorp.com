import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {monthFunding} from '@/lib/operations/month-funding';
import {mainFlow} from '@/lib/operations/main-flow';
import type {CloseOverview} from '@/lib/operations/month-close';
import Coverage from '@/components/operations/MonthFundingCoverage';
const id=(n:number)=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const account=(n:number,amount='40000')=>({binding_id:id(n),stage:'publication_ready',source_ready:true,draft_id:id(n+10),draft_status:'approved',draft_total_cny_minor:amount,statement_id:null});
function data(){return {organization_id:id(1),month:'2024-01-01',wallet_id:id(2),balance_minor:'60000',pending_receipt_count:1,pending_receipt_minor:'99999999',accounts:[account(3),account(4)]};}
const render=(plan:ReturnType<typeof monthFunding>,available=true)=>renderToStaticMarkup(<Coverage plan={plan} locale="zh" company={id(1)} month="2024-01" owner fundingAvailable={available}/>);
it('finds a combined shortfall even when every draft fits individually, excludes pending receipts and makes main flow pending',()=>{
 const input=data(),plan=monthFunding(input)!;expect(plan.approved_minor).toBe('80000');expect(plan.shortfall_minor).toBe('20000');expect(plan.remaining_minor).toBe('-20000');expect(plan.state).toBe('shortfall');expect(mainFlow(input as unknown as CloseOverview,{financeAccess:null,payments:null},true)[0].state).toBe('pending');const html=render(plan);expect(html).toContain('CNY 200.00');expect(html).toContain('待核对到账未计入');expect(html).toContain('month=2024-01');expect(html).toContain('核对真实到账');
});
it('does not count posted, pending-review, rejected or archived drafts, and does not claim all monthly fees are covered',()=>{
 const input={...data(),accounts:[account(3),{...account(4),stage:'settlement_review_needed',draft_status:null}]};const plan=monthFunding(input)!;expect(plan.approved_minor).toBe('40000');expect(plan.excluded_count).toBe(1);expect(plan.state).toBe('covered');expect(mainFlow(input as unknown as CloseOverview,{financeAccess:null,payments:null},true)[0].state).toBe('pending');
 const posted={...account(4),stage:'published',statement_id:id(30)};const archived={...account(5),stage:'quote_archived'};const rejected={...account(6),stage:'settlement_rejected',draft_status:'rejected'};const all=monthFunding({...data(),accounts:[account(3),posted,archived,rejected]})!;expect(all.approved_count).toBe(1);expect(all.published_count).toBe(1);expect(all.excluded_count).toBe(2);
});
it('handles no wallet, no candidates, exact coverage and zero-cost drafts without inventing charges or balances',()=>{
 const input=data();expect(monthFunding({...input,wallet_id:null})!.shortfall_minor).toBeNull();expect(render(monthFunding({...input,wallet_id:null}))).toContain('尚未开立人民币资金账户');
 expect(monthFunding({...input,balance_minor:'80000'})!.state).toBe('covered');expect(monthFunding({...input,balance_minor:'80000'})!.remaining_minor).toBe('0');expect(monthFunding({...input,accounts:[]})!.state).toBe('no_candidates');
 expect(monthFunding({...input,balance_minor:'0',accounts:[account(3,'0')]})!.state).toBe('covered');expect(monthFunding({...input,balance_minor:'-1',accounts:[account(3,'0')]})!.shortfall_minor).toBe('1');
});
it('rejects inconsistent identities, review states, duplicate drafts, invalid amounts and scope, while keeping integer precision',()=>{
 const input=data();expect(monthFunding({...input,accounts:[input.accounts[0],input.accounts[0]]})).toBeNull();expect(monthFunding({...input,accounts:[{...input.accounts[0],draft_status:null}]})).toBeNull();expect(monthFunding({...input,accounts:[{...input.accounts[0],draft_total_cny_minor:'invalid'}]})).toBeNull();expect(monthFunding(input,{organizationId:id(9),month:input.month})).toBeNull();expect(monthFunding({...input,accounts:[{...input.accounts[0],source_ready:false}]})).toBeNull();
 expect(monthFunding({...input,balance_minor:'9007199254740993'})!.remaining_minor).toBe('9007199254660993');
});
it('does not offer collection links outside the configured test company and displays unknown rather than zero',()=>{
 const html=render(monthFunding(data()),false);expect(html).not.toContain('/operations/collections?');expect(html).toContain('请管理员核实正式收款配置');expect(render(null)).toContain('不能据此认定资金充足');
});
