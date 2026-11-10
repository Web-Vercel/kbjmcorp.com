import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn(),user:vi.fn()}));vi.mock('@/lib/auth/server',()=>({authClient:m.client}));
import {POST} from '@/app/api/service/route';
const id='b0000000-0000-4000-8000-000000000001',key='c0000000-0000-4000-8000-000000000001';
const receipt={message_id:key,request_id:id,status:'resolved',created_at:'2026-11-10T00:00:00Z',replayed:false};
const body={action:'reply',requestId:id,replyKey:key,body:'FICTIONAL reply',status:'resolved'};
const request=(data:unknown,origin='https://example.test')=>new Request('https://example.test/api/service',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id:key}},error:null});m.client.mockResolvedValue({auth:{getUser:m.user},rpc:m.rpc});m.rpc.mockResolvedValue({data:{...receipt,private:'PRIVATE'},error:null});});
it('passes the stable key to the protected RPC and returns only the confirmed receipt',async()=>{
 const r=await POST(request({...body,actor_id:'FORGED',amount:'9999'}));expect(r.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('reply_service_request_once',{p_id:id,p_request:key,p_body:'FICTIONAL reply',p_status:'resolved'});expect(await r.json()).toEqual({ok:true,receipt});
});
it('rejects cross-origin, invalid key and unauthenticated submissions before any write',async()=>{
 expect((await POST(request(body,'https://evil.example'))).status).toBe(403);expect(m.client).not.toHaveBeenCalled();expect((await POST(request({...body,replyKey:'invalid'}))).status).toBe(400);m.user.mockResolvedValue({data:{user:null},error:null});expect((await POST(request(body))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled();
});
it('requires update 037 without falling back to the legacy unprotected RPC',async()=>{
 for(const code of ['PGRST202','42883']){m.rpc.mockResolvedValueOnce({data:null,error:{code,message:'PRIVATE'}});const r=await POST(request(body));expect(r.status).toBe(503);expect(await r.json()).toEqual({error:'reply_update_required'});}expect(m.rpc.mock.calls.every(c=>c[0]==='reply_service_request_once')).toBe(true);
});
it('does not confirm missing, malformed or cross-thread receipts',async()=>{
 for(const data of [null,{...receipt,request_id:key},{...receipt,message_id:'invalid'}]){m.rpc.mockResolvedValueOnce({data,error:null});const r=await POST(request(body));expect(r.status).toBe(502);expect(await r.json()).toEqual({error:'reply_unconfirmed'});}
});
it('maps revoked access, key conflicts and message limits without private database details',async()=>{
 for(const [code,status,error] of [['42501',403,'forbidden'],['40001',409,'reply_conflict'],['54000',429,'reply_limit']] as const){m.rpc.mockResolvedValueOnce({error:{code,message:'PRIVATE'}});const r=await POST(request(body));expect(r.status).toBe(status);expect(await r.json()).toEqual({error});}
});

it('normalizes UUID case so a valid receipt is not falsely treated as unknown',async()=>{
 const r=await POST(request({...body,requestId:id.toUpperCase(),replyKey:key.toUpperCase()}));expect(r.status).toBe(200);expect(m.rpc).toHaveBeenCalledWith('reply_service_request_once',expect.objectContaining({p_id:id,p_request:key}));expect(await r.json()).toEqual({ok:true,receipt});
});
