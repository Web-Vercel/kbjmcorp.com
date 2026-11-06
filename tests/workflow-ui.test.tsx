// @vitest-environment jsdom
import { cleanup,render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
const navigation=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation}));
import ProjectWorkflow from "@/components/workflow/ProjectWorkflow";
import WorkflowPreview from "@/components/workflow/WorkflowPreview";
import { emptyWorkflow } from "@/lib/workflow/demo";
const fetchMock=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("does not expose mutation forms to viewers or while records are unavailable",()=>{const {container,rerender}=render(<ProjectWorkflow locale="zh" projectId="fixture" role="viewer" data={emptyWorkflow()}/>);expect(container.querySelector('form')).toBeNull();rerender(<ProjectWorkflow locale="zh" projectId="fixture" role="staff" data={{...emptyWorkflow(),error:true}}/>);expect(container.querySelector('form')).toBeNull();});
it("retains content on conflict and requires a refresh rather than false success",async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({error:'stale_revision'}),{status:409}));
 render(<ProjectWorkflow locale="en" projectId="fixture" role="client" data={emptyWorkflow()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Title'),'Fictional brief');const body=screen.getByLabelText('Product, brand, audience and objectives') as HTMLTextAreaElement;await user.type(body,'Fictional audience and market requirements');await user.click(screen.getByRole('button',{name:'Submit version'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Refresh'));expect(body.value).toContain('Fictional');expect(navigation.refresh).not.toHaveBeenCalled();
});
it("allows browser-memory role switching, read-only mode and reset without any API calls",async()=>{
 render(<WorkflowPreview locale="zh"/>);const user=userEvent.setup();await user.type(screen.getByLabelText('标题'),'演示推广需求');await user.type(screen.getByLabelText('产品、品牌、目标受众与推广目标'),'这是虚构的推广需求以及目标客户信息。');await user.click(screen.getByRole('button',{name:'提交并保留版本'}));expect(await screen.findByRole('heading',{name:'演示推广需求'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'团队视角'}));expect(screen.getByRole('button',{name:'提交审核意见'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'客户只读视角'}));expect(document.querySelector('form')).toBeNull();await user.click(screen.getByRole('button',{name:'重置演示'}));expect(screen.queryByRole('heading',{name:'演示推广需求'})).toBeNull();expect(fetchMock).not.toHaveBeenCalled();
});
it("displays supplied text as text and omits unsafe reference links",()=>{
 render(<ProjectWorkflow locale="en" projectId="fixture" role="viewer" data={{...emptyWorkflow(),submissions:[{id:'fixture',project_id:'fixture',kind:'brief',version:1,title:'<script>test</script>',body:'<img src=x onerror=alert(1)>',reference_url:'javascript:alert(1)',author_role:'client',created_at:'2026-11-05T18:00:00Z'}]}}/>);expect(document.querySelector('script')).toBeNull();expect(document.querySelector('img')).toBeNull();expect(document.querySelector('a')).toBeNull();expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
});
