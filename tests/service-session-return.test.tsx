// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
const nav=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn()}));vi.mock('next/navigation',()=>({useRouter:()=>nav}));
import ServiceThread from '@/components/operations/ServiceThread';import AdminForm from '@/components/admin/AdminForm';
const ticket='b0000000-0000-4000-8000-000000000002',statement='b0000000-0000-4000-8000-000000000001';
const row={id:ticket,organization_id:statement,category:'billing',subject:'FICTIONAL billing request',status:'resolved',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z',statement_id:statement,statement_month:'2026-10-01'};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('returns an expired client reply to its original request, without putting reply text in the URL or resending',async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({error:'unauthenticated'},{status:401}));vi.stubGlobal('fetch',fetcher);render(<ServiceThread locale="zh" requests={[row]} selected={row} messages={[]}/>);fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL private reply'}});fireEvent.submit(screen.getByRole('button',{name:'发送回复'}).closest('form')!);
 const target=`/zh/account/service?ticket=${ticket}&statement=${statement}#service-request-${ticket}`;await waitFor(()=>expect(nav.push).toHaveBeenCalledWith(`/zh/login?${new URLSearchParams({returnTo:target})}`));expect(nav.push.mock.calls[0][0]).not.toContain('private');expect(fetcher).toHaveBeenCalledTimes(1);expect(nav.refresh).not.toHaveBeenCalled();expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({action:'reply',requestId:ticket,body:'FICTIONAL private reply'});
});
it('preserves staff-login handling for an expired finance reply',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'unauthenticated'},{status:401})));render(<ServiceThread locale="zh" requests={[row]} selected={row} messages={[]} staff/>);fireEvent.change(screen.getByLabelText('回复内容'),{target:{value:'FICTIONAL staff reply'}});fireEvent.submit(screen.getByRole('button',{name:'发送回复'}).closest('form')!);await waitFor(()=>expect(nav.push).toHaveBeenCalledWith('/zh/admin/login'));
});
it('does not trust a forged return destination passed to a generic client form',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'unauthenticated'},{status:401})));render(<AdminForm locale="zh" endpoint="/api/service" loginMode="client" returnTo="https://evil.example" button="提交测试"><input name="body" defaultValue="FICTIONAL"/></AdminForm>);fireEvent.submit(screen.getByRole('button').closest('form')!);await waitFor(()=>expect(nav.push).toHaveBeenCalledWith('/zh/login'));
});
