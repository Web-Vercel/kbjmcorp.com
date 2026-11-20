// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import MfaDeadline from '@/components/auth/MfaDeadline';
vi.mock('@/lib/auth/session-sync',()=>({notifySessionChange:vi.fn(),reloadForSessionChange:vi.fn()}));
const fetchMock=vi.fn();
const now=Date.parse('2026-11-20T18:00:00Z');
const props={deadline:now+300000,serverNow:now,userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',portal:'admin' as const,locale:'zh' as const,setup:false,finished:false,destination:'/zh/admin'};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.open=true;}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.open=false;}});});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('expires after five minutes without typing and locks while checking the session',async()=>{fetchMock.mockReturnValue(new Promise(()=>{}));render(<MfaDeadline {...props}/>);await act(async()=>{vi.advanceTimersByTime(299000);});expect(fetchMock).not.toHaveBeenCalled();await act(async()=>{vi.advanceTimersByTime(1000);});expect(fetchMock).toHaveBeenCalledTimes(1);expect(screen.getByRole('dialog').getAttribute('open')).not.toBeNull();expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({portal:'admin',expectedUserId:props.userId});});
it('keeps a failed sign-out locked until explicit retry',async()=>{fetchMock.mockResolvedValue({ok:false,status:503});render(<MfaDeadline {...props}/>);await act(async()=>{vi.advanceTimersByTime(300000);});expect(screen.getByText('重试退出')).toBeTruthy();await act(async()=>{vi.advanceTimersByTime(60000);});expect(fetchMock).toHaveBeenCalledTimes(1);await act(async()=>{fireEvent.click(screen.getByText('重试退出'));});expect(fetchMock).toHaveBeenCalledTimes(2);});
it('uses server time despite a skewed local clock',async()=>{vi.setSystemTime(now+3600000);fetchMock.mockReturnValue(new Promise(()=>{}));render(<MfaDeadline {...props}/>);expect(screen.getByRole('status').textContent).toContain('5:00');await act(async()=>{vi.advanceTimersByTime(299000);});expect(fetchMock).not.toHaveBeenCalled();});
it('checks immediately after waking beyond the deadline',async()=>{fetchMock.mockReturnValue(new Promise(()=>{}));render(<MfaDeadline {...props}/>);vi.setSystemTime(now+600000);await act(async()=>{fireEvent.focus(window);});expect(fetchMock).toHaveBeenCalledTimes(1);});
it('allows ten minutes for initial enrollment, and a remount uses the original deadline',async()=>{fetchMock.mockReturnValue(new Promise(()=>{}));const view=render(<MfaDeadline {...props} setup deadline={now+600000}/>);await act(async()=>{vi.advanceTimersByTime(300000);});expect(fetchMock).not.toHaveBeenCalled();view.unmount();render(<MfaDeadline {...props} setup deadline={now+600000} serverNow={now+300000}/>);await act(async()=>{vi.advanceTimersByTime(300000);});expect(fetchMock).toHaveBeenCalledTimes(1);});
it('stops the timer once verification finishes',async()=>{render(<MfaDeadline {...props} finished/>);await act(async()=>{vi.advanceTimersByTime(600000);});expect(fetchMock).not.toHaveBeenCalled();});
