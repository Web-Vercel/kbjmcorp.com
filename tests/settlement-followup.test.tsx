// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import Followup from '@/components/operations/SettlementFollowup';
const org='b0000000-0000-4000-8000-000000000001',quote='c0000000-0000-4000-8000-000000000001';
const base={locale:'zh' as const,company:org,month:'2026-10',draftId:'draft-test',quoteId:quote,status:'rejected',archived:false,published:false,owner:true,canReview:true,preparedByMe:false};
afterEach(cleanup);
it('loads the exact original quote for rejection revision in its actual company/month',()=>{
 render(<Followup {...base}/>);expect(screen.getByRole('link',{name:'载入原报价并修订（另存新版本）'}).getAttribute('href')).toBe(`/zh/operations/pricing?company=${org}&month=2026-10&edit=${quote}#quote-editor`);expect(screen.getByText(/不能修改这份已退回草稿/)).toBeDefined();
});
it('does not offer private quote editing to a finance reviewer',()=>{
 render(<Followup {...base} owner={false}/>);expect(screen.queryByRole('link',{name:'载入原报价并修订（另存新版本）'})).toBeNull();expect(screen.getByRole('link',{name:'查看本月报价，并请管理员修订'}).getAttribute('href')).toBe(`/zh/operations/pricing?company=${org}&month=2026-10#saved-quotes`);
});
it('routes archived quotes to revision instead of an approval/publication instruction',()=>{
 render(<Followup {...base} status="approved" archived/>);expect(screen.getByText(/关联报价已归档/)).toBeDefined();expect(screen.queryByRole('link',{name:'前往本草稿发布核对'})).toBeNull();
});
it('links approved drafts to their own publication section only for administrators',()=>{
 const view=render(<Followup {...base} status="approved"/>);expect(screen.getByRole('link',{name:'前往本草稿发布核对'}).getAttribute('href')).toBe('#publish-draft-draft-test');view.rerender(<Followup {...base} status="approved" owner={false}/>);expect(screen.queryByRole('link',{name:'前往本草稿发布核对'})).toBeNull();expect(screen.getByText(/下一步由管理员核对资金并正式发布/)).toBeDefined();
});
it('never offers revision or publication for a posted draft, even when its quote was later archived',()=>{
 render(<Followup {...base} published archived/>);expect(screen.queryByRole('link',{name:/修订/})).toBeNull();expect(screen.getByRole('link',{name:'核查本月公司间到账与核销'}).getAttribute('href')).toContain(`company=${org}&month=2026-10`);expect(screen.getByText(/不能通过重新编辑或另存草稿再次结算/)).toBeDefined();
});
it('retains independent review and handles unknown status without optimistic completion',()=>{
 const view=render(<Followup {...base} status="pending" preparedByMe/>);expect(screen.getByText(/本账号是制单人/)).toBeDefined();view.rerender(<Followup {...base} locale="en" status="unexpected"/>);expect(screen.getByText(/review status is unconfirmed/)).toBeDefined();expect(screen.queryByRole('link',{name:/revise/})).toBeNull();
});
