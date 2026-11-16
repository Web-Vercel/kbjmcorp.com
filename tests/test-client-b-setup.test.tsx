// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Setup from '@/components/live-access/TestClientBSetup';
import {testClientBSetup} from '@/lib/live-access/test-client-b';
const id='b0000000-0000-4000-8000-000000000002',userId='b0000000-0000-4000-8000-000000000003';
const org={id,name:'测试企业B'};const props={locale:'zh' as const,organization:org,email:'owner+client-isolation-b@gmail.com',existing:false,active:false};
const fetcher=vi.fn();
beforeEach(()=>{vi.stubGlobal('fetch',fetcher);fetcher.mockReset();});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status});}
it('enables setup only for a unique existing fictional B company in Preview using the owner mailbox alias',()=>{
 expect(testClientBSetup(false,'owner@gmail.com',[org],[])).toBeNull();expect(testClientBSetup(true,'owner@example.com',[org],[])).toBeNull();expect(testClientBSetup(true,'owner@gmail.com',[org,org],[])).toBeNull();
 expect(testClientBSetup(true,'owner+admin@gmail.com',[org],[])).toMatchObject({email:props.email,organization:org,existing:false});
 expect(testClientBSetup(true,'owner@gmail.com',[org],[{organization_id:id,role:'client',expected_email:'existing@example.test',active:true}])).toMatchObject({existing:true,email:'existing@example.test',active:true});
 expect(testClientBSetup(true,'owner@gmail.com',[org],[{organization_id:userId,role:'client',expected_email:props.email,active:true}])).toBeNull();
});
it('creates paused access then activates only the returned client B revision without sending the password again',async()=>{
 fetcher.mockResolvedValueOnce(response({ok:true,userId,organizationId:id,role:'client',active:false,revision:1})).mockResolvedValueOnce(response({ok:true,revision:2}));render(<Setup {...props}/>);
 fireEvent.click(screen.getByRole('button',{name:'创建并启用客户乙（测试）'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('已创建并启用'));
 expect(fetcher).toHaveBeenCalledTimes(2);const first=JSON.parse(fetcher.mock.calls[0][1].body),second=JSON.parse(fetcher.mock.calls[1][1].body);
 expect(first).toMatchObject({email:props.email,organizationId:id,role:'client',confirm:'on'});expect(first.password.length).toBeGreaterThanOrEqual(32);
 expect(second).toMatchObject({userId,organizationId:id,role:'client',active:'yes',revision:'1'});expect(second).not.toHaveProperty('password');
 expect(screen.getByLabelText(/初始密码/).getAttribute('type')).toBe('password');
});
it('does not activate a wrong-company reply and locks further creation after an uncertain result',async()=>{
 fetcher.mockResolvedValue(response({ok:true,userId,organizationId:userId,role:'client',active:false,revision:1}));render(<Setup {...props}/>);const button=screen.getByRole('button',{name:'创建并启用客户乙（测试）'});fireEvent.click(button);await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('需要核查'));fireEvent.click(button);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps a created account recoverable when activation fails, without retrying creation',async()=>{
 fetcher.mockResolvedValueOnce(response({ok:true,userId,organizationId:id,role:'client',active:false,revision:1})).mockResolvedValueOnce(response({error:'unavailable'},503));render(<Setup {...props}/>);fireEvent.click(screen.getByRole('button',{name:'创建并启用客户乙（测试）'}));await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('启用结果待核查'));expect(fetcher).toHaveBeenCalledTimes(2);
});
it('uses an existing B account without offering another create action',()=>{render(<Setup {...props} existing active/>);expect(screen.getByText(/已有客户账号/)).toBeTruthy();expect(screen.queryByRole('button',{name:'创建并启用客户乙（测试）'})).toBeNull();expect(fetcher).not.toHaveBeenCalled();});
