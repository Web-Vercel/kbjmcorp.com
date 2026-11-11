// @vitest-environment jsdom
import { cleanup,render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
const navigation=vi.hoisted(()=>({replace:vi.fn(),push:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation}));
import AdminForm from "@/components/admin/AdminForm";
import StaffLogin from "@/components/admin/StaffLogin";
import StaffMfa from "@/components/admin/StaffMfa";
import ProjectFields from "@/components/admin/ProjectFields";
const fetchMock=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("retains internal note content if a save fails",async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({error:'save_failed'}),{status:502}));
 render(<AdminForm locale="zh" endpoint="/api/admin/test" button="保存"><label>跟进记录<textarea name="body" required/></label></AdminForm>);
 const user=userEvent.setup();const note=screen.getByLabelText('跟进记录') as HTMLTextAreaElement;await user.type(note,'Test-only internal note');await user.click(screen.getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('操作未完成'));expect(note.value).toBe('Test-only internal note');expect(navigation.refresh).not.toHaveBeenCalled();
});
it("refreshes a successful mutation and clears the submitted form",async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:201}));
 render(<AdminForm locale="en" endpoint="/api/admin/test" button="Save"><label>Note<textarea name="body" required/></label></AdminForm>);
 const user=userEvent.setup();const note=screen.getByLabelText('Note') as HTMLTextAreaElement;await user.type(note,'Fixture note');await user.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(navigation.refresh).toHaveBeenCalled());expect(note.value).toBe('');expect(fetchMock).toHaveBeenCalledWith('/api/admin/test',expect.objectContaining({body:'{"body":"Fixture note"}'}));
});
it("does not call hosted Auth from the unconfigured staff login",async()=>{
 render(<StaffLogin locale="zh" enabled={false} siteKey=""/>);const user=userEvent.setup();await user.type(screen.getByLabelText('工作邮箱'),'fixture@example.com');await user.type(screen.getByLabelText('密码'),'test-only-password');await user.click(screen.getByRole('button',{name:'管理员登录'}));
 expect(fetchMock).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('账号登录暂不可用');
});
it("renders the official SDK's SVG data URI without double encoding it",async()=>{
 const qr='data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
 fetchMock.mockResolvedValue(new Response(JSON.stringify({factorId:'fixture-factor',qrCode:qr}),{status:200}));
 render(<StaffMfa locale="zh"/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'设置验证器'}));
 const image=await screen.findByRole('img',{name:'验证器设置二维码'});expect(image.getAttribute('src')).toBe(qr);expect(document.querySelector('svg')).toBeNull();
});
it("routes to the workspace only after a real successful MFA response",async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}));render(<StaffMfa locale="en" verifiedFactorId="fixture-factor"/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Six-digit authenticator code'),'123456');await user.click(screen.getByRole('button',{name:'Verify & enter workspace'}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith('/en/admin'));
});
it("limits selectable ad accounts to the selected organization and resets the selection on change",async()=>{
 render(<form><ProjectFields locale="zh" organizations={[{id:'org-a',name:'Company A'},{id:'org-b',name:'Company B'}]} accounts={[{id:'account-a',organization_id:'org-a',label:'Account A',external_id:'fixture-A'},{id:'account-b',organization_id:'org-b',label:'Account B',external_id:'fixture-B'}]}/></form>);
 const user=userEvent.setup();const account=screen.getByLabelText('广告账户关联（选填）') as HTMLSelectElement;expect(screen.queryByRole('option',{name:'Account B'})).toBeNull();await user.selectOptions(account,'account-a');await user.selectOptions(screen.getByLabelText('客户公司'),'org-b');expect(account.value).toBe('');expect(screen.queryByRole('option',{name:'Account A'})).toBeNull();expect(screen.getByRole('option',{name:'Account B'})).toBeTruthy();
});
