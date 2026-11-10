// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/components/Captcha", () => ({ default: ({ onToken }: { onToken: (token: string) => void }) => <button type="button" onClick={() => onToken("fixture-captcha")}>Complete test CAPTCHA</button> }));
import PhoneLogin from "@/components/PhoneLogin";
const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("中国大陆手机号"), "13800138000");
  await user.click(screen.getByRole("checkbox"));
  return user;
}
describe("Chinese phone login interaction", () => {
  it("does not request SMS while disabled", async () => {
    render(<PhoneLogin locale="zh" enabled={false} siteKey="" codeLength={6} />);
    const user = await fill(); await user.click(screen.getByRole("button", { name: /获取短信验证码/ }));
    expect(screen.getByRole("status").textContent).toContain("暂未开放"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires CAPTCHA before making a request", async () => {
    render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} />);
    const user = await fill(); await user.click(screen.getByRole("button", { name: /获取短信验证码/ }));
    expect(screen.getByRole("status").textContent).toContain("安全验证"); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("shows OTP entry only after provider acceptance, then navigates after verified login", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} />);
    const user = await fill(); await user.click(screen.getByText("Complete test CAPTCHA"));
    await user.click(screen.getByRole("button", { name: /获取短信验证码/ }));
    const code = await screen.findByLabelText("短信验证码"); expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(screen.getByRole("status").textContent).toContain("请求已受理");
    const resend = screen.getByRole("button", { name: /秒后可重新获取/ }); expect(resend.hasAttribute("disabled")).toBe(true);
    await user.type(code, "123456"); await user.click(screen.getByRole("button", { name: /验证并登录/ }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/zh/account"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/verify", expect.objectContaining({ body: JSON.stringify({ phone: "13800138000", code: "123456" }) }));
  });
  it("does not show sent or OTP input after provider rejection", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 502 }));
    render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} />);
    const user = await fill(); await user.click(screen.getByText("Complete test CAPTCHA")); await user.click(screen.getByRole("button", { name: /获取短信验证码/ }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("暂时无法"));
    expect(screen.queryByLabelText("短信验证码")).toBeNull(); expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("retains OTP entry and displays a localized error for an expired code", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response("{}", { status: 400 }));
    render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} />);
    const user = await fill(); await user.click(screen.getByText("Complete test CAPTCHA")); await user.click(screen.getByRole("button", { name: /获取短信验证码/ }));
    await user.type(await screen.findByLabelText("短信验证码"), "123456"); await user.click(screen.getByRole("button", { name: /验证并登录/ }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("已过期")); expect(navigation.replace).not.toHaveBeenCalled();
  });
});

it('returns verified application sign-ins to the application page without changing the default sign-in path',async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}));
 render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} applicationFlow/>);
 const user=await fill();await user.click(screen.getByRole('button',{name:'Complete test CAPTCHA'}));await user.click(screen.getByRole('button',{name:/获取短信验证码/}));await user.type(await screen.findByLabelText('短信验证码'),'123456');await user.click(screen.getByRole('button',{name:/验证并登录/}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith('/zh/account/application'));
});

it.each([`/zh/account/statements?statement=b0000000-0000-4000-8000-000000000001#statement-b0000000-0000-4000-8000-000000000001`,'https://evil.example'])('returns to an authorized-type destination only after verified login (%s)',async returnTo=>{
 fetchMock.mockResolvedValue(new Response('{}',{status:200}));render(<PhoneLogin locale="zh" enabled siteKey="fixture" codeLength={6} returnTo={returnTo}/>);
 const user=await fill();await user.click(screen.getByText('Complete test CAPTCHA'));await user.click(screen.getByRole('button',{name:/获取短信验证码/}));await user.type(await screen.findByLabelText('短信验证码'),'123456');expect(navigation.replace).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:/验证并登录/}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith(returnTo.startsWith('/zh/account/statements')?returnTo:'/zh/account'));
 expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({phone:'13800138000',code:'123456'});
});
