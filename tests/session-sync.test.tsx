// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,render,fireEvent,waitFor} from '@testing-library/react';
const reload=vi.hoisted(()=>vi.fn());vi.mock('@/lib/auth/session-sync',async importOriginal=>({...await importOriginal<typeof import('@/lib/auth/session-sync')>(),reloadForSessionChange:reload}));
import Sync from '@/components/session/SessionSync';
import {notifySessionChange,sessionChannel} from '@/lib/auth/session-sync';
const fetcher=vi.fn();beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset();});afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
it('reloads after another tab signs in or out, discarding previous-account UI state',()=>{render(<Sync userId="client-a" email="a@example.test"/>);fireEvent(window,new StorageEvent('storage',{key:sessionChannel,newValue:'changed'}));expect(reload).toHaveBeenCalledTimes(1);});
it('checks the server identity on focus and reloads if the shared cookie now belongs to B',async()=>{fetcher.mockResolvedValue({ok:true,json:async()=>({userId:'client-b',email:'b@example.test'})});render(<Sync userId="client-a" email="a@example.test"/>);fireEvent.focus(window);await waitFor(()=>expect(reload).toHaveBeenCalledTimes(1));});
it('does not refresh an unchanged staff session or discard unsaved work on ordinary focus',async()=>{fetcher.mockResolvedValue({ok:true,json:async()=>({userId:'staff-a',email:'staff@example.test'})});render(<Sync userId="staff-a" email="staff@example.test"/>);fireEvent.focus(window);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));expect(reload).not.toHaveBeenCalled();});
it('does not treat an unavailable check as another signed-in account',async()=>{fetcher.mockResolvedValue({ok:false,status:503});render(<Sync userId="client-a" email="a@example.test"/>);fireEvent.focus(window);await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));expect(reload).not.toHaveBeenCalled();});
it('broadcasts only an invalidation signal, never an email or token',()=>{const post=vi.fn(),close=vi.fn();vi.stubGlobal('BroadcastChannel',class{postMessage=post;close=close;});notifySessionChange();expect(post).toHaveBeenCalledWith('changed');expect(close).toHaveBeenCalled();expect(localStorage.getItem(sessionChannel)).toMatch(/^\d+$/);});
