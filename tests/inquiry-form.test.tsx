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
