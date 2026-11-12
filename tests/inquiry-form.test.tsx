// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InquiryForm from "@/components/InquiryForm";
const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function fillCompanyAndMessage() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("公司名称"), "测试出海企业");
  await user.type(screen.getByLabelText("您的出海目标"), "我们希望为产品制定北美市场的广告测试计划。");
  await user.click(screen.getByRole("checkbox"));
  return user;
}
it("requires at least one contact method and focuses the phone input", async () => {
  render(<InquiryForm locale="zh" />);
  const phone = screen.getByLabelText("联系电话（中国大陆）");
  const user = await fillCompanyAndMessage(); await user.click(screen.getByRole("button", { name: /发送合作咨询/ }));
  expect(phone.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(phone);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("accepts a phone-only inquiry without forcing an email or sending SMS", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
  render(<InquiryForm locale="zh" />);
  const user = await fillCompanyAndMessage(); await user.type(screen.getByLabelText("联系电话（中国大陆）"), "13800138000");
  await user.selectOptions(screen.getByLabelText("计划进入的市场"), "global");
  await user.click(screen.getByRole("button", { name: /发送合作咨询/ }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("咨询已收到"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({ body: expect.stringContaining('"market":"global"') }));
  expect(fetchMock).toHaveBeenCalledWith("/api/inquiries", expect.objectContaining({ body: expect.stringContaining('"phone":"13800138000"') }));
});
it("retains entered contact details if the backend is unconfigured", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
  render(<InquiryForm locale="zh" />);
  const user = await fillCompanyAndMessage(); const phone = screen.getByLabelText("联系电话（中国大陆）") as HTMLInputElement;
  await user.type(phone, "13800138000"); await user.click(screen.getByRole("button", { name: /发送合作咨询/ }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("尚未配置")); expect(phone.value).toBe("13800138000");
});
it("provides English field validation when English is selected", async () => {
  render(<InquiryForm locale="en" />);
  const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: /Send inquiry/ }));
  expect(screen.getByText("Enter a company name of 2–160 characters.")).toBeTruthy(); expect(fetchMock).not.toHaveBeenCalled();
});
it('accepts an individual partnership application through the inquiry flow without creating an account',async()=>{
 fetchMock.mockResolvedValue(new Response('{}',{status:201}));render(<InquiryForm locale="zh" purpose="partner"/>);const user=userEvent.setup();await user.type(screen.getByLabelText('姓名、团队或公司名称'),'王小明');await user.type(screen.getByLabelText('联系邮箱（选填）'),'fixture@example.test');await user.type(screen.getByLabelText('意向合作模式与资源情况'),'我希望申请推荐合作伙伴，拥有企业客户资源。');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:/申请成为合作伙伴/}));await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(1));const [url,options]=fetchMock.mock.calls[0];expect(url).toBe('/api/inquiries');const body=JSON.parse(options.body);expect(body.company).toBe('王小明');expect(body.message).toBe('合作伙伴申请\n我希望申请推荐合作伙伴，拥有企业客户资源。');await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('合作申请已收到'));
});
it('does not let the partnership prefix bypass validation of an empty English message',async()=>{
 render(<InquiryForm locale="en" purpose="partner"/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Your name, team or company'),'Fixture Referrer');await user.type(screen.getByLabelText('Contact email (optional)'),'fixture@example.test');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:/Apply to become a partner/}));expect(fetchMock).not.toHaveBeenCalled();expect(screen.getByLabelText(/Preferred partnership model and relevant experience/).getAttribute('aria-invalid')).toBe('true');
});
