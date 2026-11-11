// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const navigation=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>navigation}));
vi.mock('@/components/Captcha',()=>({default:({onToken}:{onToken:(token:string)=>void})=><button type="button" onClick={()=>onToken('fixture-captcha')}>Complete fixture CAPTCHA</button>}));
import ClientTestLogin from '@/components/client/ClientTestLogin';
const fetchMock=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function fill(){const user=userEvent.setup();await user.type(screen.getByLabelText('测试客户邮箱'),'client@example.test');await user.type(screen.getByLabelText('密码'),'fixture-only-password');return user;}
it('never submits without a CAPTCHA result',async()=>{render(<ClientTestLogin locale="zh" siteKey="fixture"/>);const user=await fill();await user.click(screen.getByRole('button',{name:'登录测试客户中心'}));expect(fetchMock).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('安全验证');});
it('enters the actual client portal only after API acceptance',async()=>{fetchMock.mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}));render(<ClientTestLogin locale="zh" siteKey="fixture"/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Complete fixture CAPTCHA'}));await user.click(screen.getByRole('button',{name:'登录测试客户中心'}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith('/zh/account'));expect(fetchMock).toHaveBeenCalledWith('/api/auth/test-email',expect.objectContaining({method:'POST'}));expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');});
it('clears the password and does not navigate when authorization fails',async()=>{fetchMock.mockResolvedValue(new Response(JSON.stringify({error:'invalid_credentials'}),{status:401}));render(<ClientTestLogin locale="zh" siteKey="fixture"/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Complete fixture CAPTCHA'}));await user.click(screen.getByRole('button',{name:'登录测试客户中心'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('公司授权'));expect(navigation.replace).not.toHaveBeenCalled();expect((screen.getByLabelText('密码') as HTMLInputElement).value).toBe('');});

it.each([`/zh/account/funds?wallet=b0000000-0000-4000-8000-000000000001&month=2026-10`,`/zh/account/statements?statement=b0000000-0000-4000-8000-000000000001#statement-b0000000-0000-4000-8000-000000000001`,`/zh/account/service?ticket=b0000000-0000-4000-8000-000000000002&statement=b0000000-0000-4000-8000-000000000001#service-request-b0000000-0000-4000-8000-000000000002`,'/zh/admin'])('uses a validated statement return target after test authentication (%s)',async returnTo=>{
 fetchMock.mockResolvedValue(new Response('{}',{status:200}));render(<ClientTestLogin locale="zh" siteKey="fixture" returnTo={returnTo}/>);const user=await fill();await user.click(screen.getByRole('button',{name:'Complete fixture CAPTCHA'}));await user.click(screen.getByRole('button',{name:'登录测试客户中心'}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith(returnTo.startsWith('/zh/account/')?returnTo:'/zh/account'));
});
