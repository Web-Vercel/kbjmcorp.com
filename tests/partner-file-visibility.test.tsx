// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({refresh:vi.fn(),fetch:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
import Visibility from '@/components/partners/FileVisibility';
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',m.fetch);});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('moves a file only after confirmation succeeds and refreshes its list',async()=>{m.fetch.mockResolvedValue({ok:true});render(<Visibility fileId="a0000000-0000-4000-8000-000000000001" hidden={false}/>);fireEvent.click(screen.getByRole('checkbox',{hidden:true}));fireEvent.submit(screen.getByRole('button',{name:'确认移除',hidden:true}).closest('form')!);await waitFor(()=>expect(m.refresh).toHaveBeenCalledOnce());expect(JSON.parse(m.fetch.mock.calls[0][1].body)).toMatchObject({hidden:true,reason:'mistake'});});
it('does not present an unknown outcome as a successful removal',async()=>{m.fetch.mockRejectedValue(Error('network'));render(<Visibility fileId="a0000000-0000-4000-8000-000000000001" hidden={true}/>);fireEvent.submit(screen.getByRole('button',{name:'确认恢复',hidden:true}).closest('form')!);await waitFor(()=>expect(screen.getByRole('status',{hidden:true}).textContent).toContain('操作结果未确认'));expect(m.refresh).not.toHaveBeenCalled();});
