import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),from:vi.fn(),single:vi.fn(),wallet:vi.fn(),account:vi.fn()}));
vi.mock('@/lib/collections/test-mode',()=>({collectionTestOrganization:()=> 'test-org',testAccountNumber:'TEST-NOT-PAYABLE-001',testEvidence:'FICTIONAL-TEST-ONLY-001',validTestWallet:m.wallet,validTestAccount:m.account}));
vi.mock('@/lib/admin/guard',async()=>{const {authResponse}=await import('@/lib/auth/http');return{getStaffContext:m.guard,staffError:(r:{error:string;status:number})=>authResponse({error:r.error},r.status)};});
import {POST} from '@/app/api/collections/route';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const req=(data:object)=>new Request('https://site.example/api/collections',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json'},body:JSON.stringify({...data,confirm:'on'})});
beforeEach(()=>{vi.resetAllMocks();m.guard.mockResolvedValue({role:'admin',client:{rpc:m.rpc,from:m.from}});m.rpc.mockResolvedValue({data:id,error:null});m.wallet.mockResolvedValue(true);m.account.mockResolvedValue(true);const q={select:()=>q,eq:()=>q,maybeSingle:m.single};m.from.mockReturnValue(q);});
it('forces nonpayable fictional account identity and verifies company',async()=>{
 m.single.mockResolvedValue({data:{name:'财务流程验收企业（虚构）'}});
 expect((await POST(req({action:'account',legalName:'Caller real name',bankName:'Caller real bank',accountNumber:'123456789',evidence:'REAL-EVIDENCE'}))).status).toBe(200);
 expect(m.rpc).toHaveBeenCalledWith('create_collection_account',expect.objectContaining({p_number:'TEST-NOT-PAYABLE-001',p_evidence:'FICTIONAL-TEST-ONLY-001'}));
});
it('rejects another wallet before any write',async()=>{m.wallet.mockResolvedValue(false);expect((await POST(req({action:'assign',walletId:id,accountId:id,agreement:'Test agreement'}))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();});
it('rejects real receiving accounts',async()=>{m.account.mockResolvedValue(false);expect((await POST(req({action:'assign',walletId:id,accountId:id,agreement:'Test agreement'}))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();});
it('rejects receipt approval outside the test scope',async()=>{m.single.mockResolvedValue({data:{wallet_id:id,collection_account_id:id,evidence_reference:'REAL-BANK'}});expect((await POST(req({action:'review',receiptId:id,decision:'credited',note:'Test review'}))).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();});
it('keeps exact money and marks fictional receipt evidence',async()=>{
 m.single.mockResolvedValue({data:{collection_account_id:id}});
 expect((await POST(req({action:'receipt',walletId:id,amount:'1000.01',payerName:'Caller payer',bankReference:'TEST001',bookedDate:'2026-11-07',evidence:'Caller evidence'}))).status).toBe(200);
 expect(m.rpc).toHaveBeenCalledWith('prepare_bank_receipt',expect.objectContaining({p_amount:'100001',p_evidence:'FICTIONAL-TEST-ONLY',p_bank_reference:'FICTIONAL-TEST001'}));
});
it('fails closed on scope query failure',async()=>{m.wallet.mockRejectedValue(new Error('private'));expect((await POST(req({action:'assign',walletId:id,accountId:id,agreement:'Test agreement'}))).status).toBe(503);});
