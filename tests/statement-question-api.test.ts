import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),rpc:vi.fn()}));vi.mock('@/lib/auth/server',()=>({authClient:m.auth}));
import {POST} from '@/app/api/client/statement-question/route';
const statement='b0000000-0000-4000-8000-000000000001',key='b0000000-0000-4000-8000-000000000002',ticket='b0000000-0000-4000-8000-000000000003';
const body={statementId:statement,requestId:key,subject:'FICTIONAL QUESTION',body:'Please explain this fictional bill.'};
const req=(value:unknown,origin='https://site.example')=>new Request('https://site.example/api/client/statement-question',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({auth:{getUser:m.user},rpc:m.rpc});m.user.mockResolvedValue({data:{user:{id:'verified'}},error:null});m.rpc.mockResolvedValue({data:ticket,error:null});});
it('derives statement company and month in SQL and ignores forged identity, amounts and statuses',async()=>{
 const r=await POST(req({...body,organizationId:'forged',month:'1900-01',amount:'0',status:'resolved',userId:'admin'}));expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true,requestId:ticket});expect(m.rpc).toHaveBeenCalledWith('create_statement_question',{p_statement:statement,p_request:key,p_subject:body.subject,p_body:body.body});
});
it('requires same origin, valid bounded text, request key and an authenticated user',async()=>{
 expect((await POST(req(body,'https://evil.example'))).status).toBe(403);expect(m.auth).not.toHaveBeenCalled();expect((await POST(req({...body,requestId:''}))).status).toBe(400);expect((await POST(req({...body,body:'x'.repeat(1501)}))).status).toBe(400);m.user.mockResolvedValue({data:{user:null},error:null});expect((await POST(req(body))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();
});
it('does not expose raw errors or treat malformed response IDs as success',async()=>{
 for(const [code,status] of [['42501',403],['54000',429],['22023',400],['XX000',503]]){m.rpc.mockResolvedValueOnce({data:null,error:{code,message:'PRIVATE RAW'}});const r=await POST(req(body));expect(r.status).toBe(status);expect(await r.text()).not.toContain('PRIVATE RAW');}
 m.rpc.mockResolvedValueOnce({data:'invalid',error:null});expect((await POST(req(body))).status).toBe(503);
});
