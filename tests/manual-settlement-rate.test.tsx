// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
import Rate from '@/components/operations/ManualSettlementRate';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requires reading and explicit confirmation; unknown saves cannot be repeated',async()=>{const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({ok:true,reference:{rate:'5.12345678',date:'2026-11-19',source:'Bank of Canada'}})}).mockResolvedValueOnce({ok:false,json:async()=>({error:'unconfirmed'})});vi.stubGlobal('fetch',fetch);render(<Rate locale="zh"/>);fireEvent.click(screen.getByText('登记手工草稿的结算汇率'));fireEvent.click(screen.getByRole('button',{name:'读取参考汇率'}));await screen.findByText(/1 CAD = 5.12345678/);const save=screen.getByRole('button',{name:'确认登记参考汇率'});expect((save as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('登记结果未确认'));expect((save as HTMLButtonElement).disabled).toBe(true);fireEvent.click(save);expect(fetch).toHaveBeenCalledTimes(2);});
