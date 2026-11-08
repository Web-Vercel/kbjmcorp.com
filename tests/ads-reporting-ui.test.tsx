// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
const refresh=vi.hoisted(()=>vi.fn());
vi.mock('next/navigation',()=>({useRouter:()=>({refresh,push:vi.fn()})}));
import AdsReadSync from '@/components/operations/AdsReadSync';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('does not offer a read action until server configuration is supplied',()=>{render(<AdsReadSync locale="zh" configured={false}/>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);});
it('keeps the same request ID after network interruption, then refreshes only on confirmed storage',async()=>{const fetch=vi.fn().mockRejectedValueOnce(new Error('interrupted')).mockResolvedValueOnce(Response.json({ok:true,id:'snapshot'}));vi.stubGlobal('fetch',fetch);render(<AdsReadSync locale="zh" configured/>);const user=userEvent.setup();await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button'));expect(screen.getByRole('status').textContent).toContain('保存状态未知');expect(refresh).not.toHaveBeenCalled();await user.click(screen.getByRole('button'));expect(screen.getByRole('status').textContent).toContain('已保存内部来源快照');expect(refresh).toHaveBeenCalledTimes(1);const bodies=fetch.mock.calls.map(c=>JSON.parse(c[1].body));expect(bodies[0]).toEqual(bodies[1]);expect(Object.keys(bodies[0]).sort()).toEqual(['confirm','requestId']);});
it('explains pinned-account mismatch without announcing success',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'account_mismatch'},{status:502})));render(<AdsReadSync locale="zh" configured/>);const user=userEvent.setup();await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button'));expect(screen.getByRole('status').textContent).toContain('已停止同步');expect(refresh).not.toHaveBeenCalled();});
