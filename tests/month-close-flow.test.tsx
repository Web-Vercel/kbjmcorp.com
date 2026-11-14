import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Flow from '@/components/operations/MonthCloseFlow';
import type {CloseAccount} from '@/lib/operations/month-close';
const account={binding_id:'test',account_id:'adacct_test',account_label:'虚构验收账户',stage:'settlement_review_needed',draft_prepared_by_me:true} as CloseAccount;
const render=(a=account)=>renderToStaticMarkup(<Flow accounts={[a]} context={{owner:false,canPrepare:true,canReview:true}} locale="zh" company="test" month="2026-10" summary={[]} fundingAvailable/>);
it('shows responsibility but preserves the self-review prohibition',()=>{
 const html=render();expect(html).toContain('另一位复核员');expect(html).toContain('aria-current="step"');expect(html).not.toContain('办理这一步');
});
it('opens the existing authorized workflow for an independent reviewer',()=>{
 const html=render({...account,draft_prepared_by_me:false});expect(html).toContain('/zh/operations/settlements?company=test&amp;month=2026-10');expect(html).toContain('办理这一步');
});
it('does not permit funding actions when collection scope is unavailable',()=>{
 const html=renderToStaticMarkup(<Flow accounts={[{...account,stage:'funding_needed'}]} context={{owner:true,canPrepare:true,canReview:true}} locale="zh" company="test" month="2026-10" summary={[]} fundingAvailable={false}/>);expect(html).not.toContain('办理这一步');
});
