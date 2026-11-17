// @vitest-environment jsdom
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import CashSummary,{type CashWallet} from '@/components/operations/CashSummary';
afterEach(cleanup);
const wallet:CashWallet={id:'test',currency:'CNY',balance_minor:'0',pending_notice_count:'0',pending_notice_minor:'0',pending_receipt_count:'1',pending_receipt_minor:'100001',recent_entries:[]};
it('distinguishes a pending receipt from zero customer notices and links to actual review',()=>{
 render(<CashSummary locale="zh" wallets={[wallet]} error={false}/>);
 const receipt=screen.getByText('到账制单 · 待独立复核').parentElement!;
 const notice=screen.getByText('付款通知 · 待核对').parentElement!;
 expect(receipt.querySelector('dd')?.textContent).toContain('CNY 1,000.01');expect(receipt.querySelector('small')?.textContent).toBe('1 笔');
 expect(notice.querySelector('dd')?.textContent).toContain('CNY 0.00');expect(notice.querySelector('small')?.textContent).toBe('0 笔');
 expect(screen.getByRole('link').getAttribute('href')).toBe('/zh/operations/collections');
});
it('never shows a zero pending total when the query failed',()=>{render(<CashSummary locale="zh" wallets={[]} error/>);expect(screen.getByText(/待复核款项状态尚未确认/)).toBeTruthy();expect(screen.queryByText(/CNY 0.00/)).toBeNull();});
