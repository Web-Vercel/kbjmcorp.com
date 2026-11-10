import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {monthCloseTasks} from '@/lib/operations/month-close-tasks';
import MonthCloseTasks from '@/components/operations/MonthCloseTasks';
import type {CloseAccount} from '@/lib/operations/month-close';
const owner={owner:true,canPrepare:true,canReview:true};
const account=(stage:CloseAccount['stage'],extra:Partial<CloseAccount>={}):CloseAccount=>({binding_id:stage,account_label:stage,stage,coverage_prepared_by_me:false,draft_prepared_by_me:false,...extra} as CloseAccount);
const tasks=(rows:CloseAccount[],context=owner,funding=true)=>monthCloseTasks(rows,context,'zh','org','2026-10',funding);
it('keeps self-review out of actionable tasks even for administrators',()=>{
 const rows=tasks([account('coverage_review_needed',{coverage_prepared_by_me:true}),account('settlement_review_needed',{draft_prepared_by_me:true}),account('settlement_review_needed')]);
 expect(rows.map(r=>r.group)).toEqual(['waiting','waiting','actionable']);expect(rows[0].reason).toContain('另一账号');
});
it('does not offer publication to finance staff and preserves unavailable prerequisites',()=>{
 expect(tasks([account('publication_ready')],{owner:false,canPrepare:true,canReview:true})[0].group).toBe('waiting');
 expect(tasks([account('funding_needed')],owner,false)[0].group).toBe('blocked');
 expect(tasks([account('month_open'),account('source_history_needed'),account('unknown' as CloseAccount['stage'])]).map(t=>t.group)).toEqual(['blocked','blocked','blocked']);
});
it('separates published receipts from actions without claiming overall completion',()=>{
 const rows=tasks([account('published'),account('quote_needed')]);expect(rows.map(r=>r.group)).toEqual(['published','actionable']);
 const html=renderToStaticMarkup(<MonthCloseTasks tasks={rows} locale="zh"/>);expect(html).toContain('不代表客户已查阅');expect(html).toContain('href="#month-close-account-quote_needed"');expect(html).not.toContain('/api/');
});
it('retains every account and explains an empty selection in both languages',()=>{
 const rows=tasks([account('source_needed'),account('coverage_needed'),account('settlement_review_needed')],{owner:false,canPrepare:true,canReview:false});expect(rows.map(t=>t.group)).toEqual(['waiting','actionable','waiting']);
 for(const locale of ['zh','en'] as const){expect(renderToStaticMarkup(<MonthCloseTasks tasks={[]} locale={locale}/>)).toContain(locale==='zh'?'尚无关联账户':'No linked accounts');}
});
