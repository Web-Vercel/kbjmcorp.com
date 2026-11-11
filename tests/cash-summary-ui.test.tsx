// @vitest-environment jsdom
import React from 'react';
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
import CashSummary,{type CashWallet} from '@/components/operations/CashSummary';
afterEach(cleanup);
const wallet:CashWallet={id:'test',currency:'CNY',balance_minor:'0',pending_notice_count:'0',pending_notice_minor:'0',pending_receipt_count:'1',pending_receipt_minor:'100001',recent_entries:[]};
it('distinguishes a pending receipt from zero customer notices and links to actual review',()=>{render(<CashSummary locale="zh" wallets={[wallet]} error={false}/>);expect(screen.getByText('到账制单（待独立复核）')).toBeTruthy();expect(screen.getByText('1 · CNY 1,000.01')).toBeTruthy();expect(screen.getByText('0 · CNY 0.00')).toBeTruthy();expect(screen.getByRole('link').getAttribute('href')).toBe('/zh/operations/collections');});
it('never shows a zero pending total when the query failed',()=>{render(<CashSummary locale="zh" wallets={[]} error/>);expect(screen.getByText(/待复核款项状态尚未确认/)).toBeTruthy();expect(screen.queryByText('0 · CNY 0.00')).toBeNull();});
