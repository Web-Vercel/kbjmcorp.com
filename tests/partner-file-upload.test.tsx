// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import FileUpload from '@/components/partners/FileUpload';
const m=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:m.refresh})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
function submit(){render(<FileUpload agents={[]} agentId="b0000000-0000-4000-8000-000000000001" leads={[]} assignments={[]}/>);fireEvent.change(screen.getByLabelText('文件'),{target:{files:[new File(['test'],'test.png',{type:'image/png'})]}});const form=screen.getByRole('button',{name:'上传并保存新版本'}).closest('form')!;const Native=globalThis.FormData;vi.stubGlobal('FormData',class extends Native{constructor(){super();this.set('file',new File(['test'],'test.png',{type:'image/png'}));}});fireEvent.submit(form);}
it('refreshes server records after confirmed upload and immediately offers the private file',async()=>{const id='c0000000-0000-4000-8000-000000000001';vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:true,id})));submit();const link=await screen.findByRole('link',{name:'打开刚上传的私密文件'});expect(link.getAttribute('href')).toBe(`/api/partner-files?id=${id}`);expect(m.refresh).toHaveBeenCalledOnce();});
it('does not offer a file or claim success for an uncertain upload',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('network')));submit();await screen.findByRole('button',{name:'刷新核实文件记录'});expect(m.refresh).not.toHaveBeenCalled();expect(screen.queryByRole('link',{name:'打开刚上传的私密文件'})).toBeNull();expect(screen.getByRole('status').textContent).toContain('不重复上传');});
