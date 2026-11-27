import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Overview from '@/components/operations/AccountBillingOverview';
import {accountBillingOverview} from '@/lib/operations/account-billing';
const company='b0000000-0000-4000-8000-000000000001',binding='c0000000-0000-4000-8000-000000000001';
const context={owner:true,roles:[],canPrepare:true,canReview:true,canSource:true,canSupport:true};
const account={binding_id:binding,account_id:'adacct_fixture',account_label:'FICTIONAL BRIANNA',active:true,first_month:'2026-11-01',automatic:true,timezone:'America/Vancouver',current_month:'2026-11-01',last_published_month:null,next_month:null,gap:false,task_month:'2026-11-01',flow:null,job:null};
it('keeps an open first month distinct from a closed month due and does not invent publication',()=>{
 const data=accountBillingOverview({organization_id:company,accounts:[account]},company)!;
 const html=renderToStaticMarkup(<Overview data={data} company={company} locale="zh" context={context}/>);
 expect(html).toContain('自动月结');expect(html).toContain('2026-11');expect(html).toContain('暂无已结束待结算月');expect(html).toContain('暂无');
 expect(accountBillingOverview({organization_id:company,accounts:[{...account,next_month:'2026-11-01'}]},company)).toBeNull();
 expect(accountBillingOverview({organization_id:binding,accounts:[account]},company)).toBeNull();
});
it('surfaces missing starts, gaps and task failures rather than treating them as empty history',()=>{
 const data=accountBillingOverview({organization_id:company,accounts:[{...account,automatic:false,first_month:'2026-08-01',last_published_month:'2026-10-01',next_month:'2026-09-01',task_month:'2026-09-01',gap:true,job:{month:'2026-09-01',state:'failed'}}]},company)!;
 const html=renderToStaticMarkup(<Overview data={data} company={company} locale="zh" context={context}/>);
 expect(html).toContain('手动办理');expect(html).toContain('2026-09 尚未出账');expect(html).toContain('自动任务需要处理');
 const unknown=renderToStaticMarkup(<Overview data={null} company={company} locale="zh" context={context}/>);expect(unknown).toContain('不能据此认定没有历史账单');
});
it('prioritizes an existing draft and retains independent review instead of offering another preparation',()=>{
 const flow={binding_id:binding,account_id:account.account_id,account_label:account.account_label,active:true,timezone:'America/Vancouver',stage:'settlement_review_needed',source_id:'d0000000-0000-4000-8000-000000000001',source_ready:true,coverage_reason:null,coverage_kind:'complete_rows',source_cad_minor:'3624',operational_source_count:0,quote_match_count:0,coverage_prepared_by_me:false,draft_id:'e0000000-0000-4000-8000-000000000001',draft_status:null,draft_prepared_by_me:true,draft_total_cny_minor:'24833',newer_shared_source:false,statement_id:null,published_at:null,posted_total_cny_minor:null};
 const data=accountBillingOverview({organization_id:company,accounts:[{...account,automatic:false,first_month:null,task_month:'2026-10-01',flow}]},company)!;
 const html=renderToStaticMarkup(<Overview data={data} company={company} locale="zh" context={context}/>);
 expect(html).toContain('首次结算月份未登记');expect(html).toContain('248.33');expect(html).toContain('另一位财务复核人员');expect(html).toContain('查看现有草稿与进度');expect(html).not.toContain('mode=prepare');
 expect(accountBillingOverview({organization_id:company,accounts:[{...account,flow:{...flow,account_id:'adacct_other'}}]},company)).toBeNull();
});
