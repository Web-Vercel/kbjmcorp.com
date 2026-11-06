// @vitest-environment jsdom
import { cleanup,render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,expect,it,vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import { money,toMinor } from "@/lib/billing/model";
import { demoBilling,demoReport,demoLines } from "@/lib/billing/demo";
import BillingDashboard from "@/components/billing/BillingDashboard";
import ReportDocument from "@/components/billing/ReportDocument";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("uses exact minor units rather than floating point for credits and fees",()=>{expect(toMinor('0.10')).toBe('10');expect(toMinor('99999999.99')).toBe('9999999999');expect(money('9007199254740993123','CAD','en')).toBe('CAD 90,071,992,547,409,931.23');expect(money('-235000','CAD','zh')).toBe('−CAD 2,350.00');for(const invalid of ['0','-1','1.001','1e4','100000000'])expect(()=>toMinor(invalid)).toThrow();});
it("does not fabricate a zero balance when the backend is unavailable",()=>{render(<BillingDashboard locale="zh" data={{wallets:[],entries:[],topups:[],reports:[],error:true}}/>);expect(screen.getByText('资金与月报暂时不可用')).toBeTruthy();expect(screen.queryByTestId('wallet-balance')).toBeNull();});
it("keeps the demo balance unchanged after a verification request",async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<BillingDashboard locale="zh" data={demoBilling('zh')} demo/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:/充值 \/ 登记付款/}));await user.type(screen.getByLabelText('充值金额（CAD）'),'500.25');await user.type(screen.getByLabelText('付款参考号'),'DEMO-REFERENCE');await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'提交充值核对'}));await waitFor(()=>expect(screen.getByText('待核对到账')).toBeTruthy());expect(screen.getByTestId('wallet-balance').textContent).toBe('CAD 7,500.00');expect(fetch).not.toHaveBeenCalled();
});
it("provides a clearly fictional Chinese report and a browser PDF action",async()=>{const print=vi.fn();vi.stubGlobal('print',print);render(<ReportDocument report={demoReport} lines={demoLines} organization="演示客户" locale="zh"/>);expect(screen.getByText(/非 OpenAI 官方报告/)).toBeTruthy();expect(screen.getByText('明细广告费用与月报广告费用合计一致。')).toBeTruthy();const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'打印 / 保存 PDF'}));expect(print).toHaveBeenCalled();});
it("disables PDF finalization when detail totals do not reconcile",()=>{render(<ReportDocument report={demoReport} lines={[]} organization="演示客户" locale="zh"/>);expect((screen.getByRole('button',{name:'打印 / 保存 PDF'}) as HTMLButtonElement).disabled).toBe(true);});
