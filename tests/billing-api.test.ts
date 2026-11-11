import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({client:vi.fn(),user:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/server",()=>({authClient:mocks.client}));
import { POST } from "@/app/api/billing/topups/route";
const walletId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const body={walletId,amount:'250.25',reference:'fixture-reference',confirm:'on'};
const request=(data:unknown,origin='https://site.example')=>new Request('https://site.example/api/billing/topups',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
beforeEach(()=>{vi.resetAllMocks();mocks.client.mockResolvedValue({auth:{getUser:mocks.user},rpc:mocks.rpc});mocks.user.mockResolvedValue({data:{user:{id:'verified'}},error:null});mocks.rpc.mockResolvedValue({data:walletId,error:null});});
it("rejects cross-origin requests before opening a session",async()=>{expect((await POST(request(body,'https://other.example'))).status).toBe(403);expect(mocks.client).not.toHaveBeenCalled();});
it("cannot claim payment success or trust a caller's credited status",async()=>{const response=await POST(request({...body,status:'credited',userId:'forged',currency:'USD'}));expect(response.status).toBe(201);expect(await response.json()).toEqual({ok:true,status:'pending',noticeId:walletId});expect(mocks.rpc).toHaveBeenCalledWith('request_client_topup',{p_wallet_id:walletId,p_amount_minor:'25025',p_reference:'fixture-reference'});expect(response.headers.get('Cache-Control')).toContain('no-store');});
it.each(['0','-100','1.001','1e6'])('rejects invalid money input %s',async amount=>{expect((await POST(request({...body,amount}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();});
it("fails closed without configuration, verified identity or finance permission",async()=>{mocks.client.mockResolvedValue(null);expect((await POST(request(body))).status).toBe(503);mocks.client.mockResolvedValue({auth:{getUser:()=>Promise.resolve({data:{user:null},error:null})}});expect((await POST(request(body))).status).toBe(401);mocks.client.mockResolvedValue({auth:{getUser:mocks.user},rpc:mocks.rpc});mocks.rpc.mockResolvedValue({error:{code:'42501',message:'private details'}});const response=await POST(request(body));expect(response.status).toBe(403);expect(await response.text()).not.toContain('private details');});
it('does not confirm a missing or malformed notification ID returned by the database',async()=>{
 for(const data of [null,'bad',{id:walletId}]){mocks.rpc.mockResolvedValueOnce({data,error:null});const r=await POST(request(body));expect(r.status).toBe(502);expect(await r.json()).toEqual({error:'notice_unconfirmed'});}
});
