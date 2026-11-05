import { beforeEach,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({client:vi.fn(),user:vi.fn(),member:vi.fn(),assurance:vi.fn()}));
vi.mock("@/lib/auth/server",()=>({authClient:mocks.client}));
import { getStaffContext } from "@/lib/admin/guard";
beforeEach(()=>{
 vi.resetAllMocks();mocks.user.mockResolvedValue({data:{user:{id:'fixture-staff',user_metadata:{role:'admin'}}},error:null});
 mocks.member.mockResolvedValue({data:{role:'admin',active:true},error:null});mocks.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null});
 const query={select:()=>query,eq:()=>query,maybeSingle:mocks.member};
 mocks.client.mockResolvedValue({auth:{getUser:mocks.user,mfa:{getAuthenticatorAssuranceLevel:mocks.assurance}},from:()=>query});
});
it("fails closed if the auth connection is missing",async()=>{mocks.client.mockResolvedValue(null);expect(await getStaffContext()).toEqual({error:'unavailable',status:503});});
it("requires verified server identity before staff lookup",async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{message:'missing'}});expect(await getStaffContext()).toEqual({error:'unauthenticated',status:401});expect(mocks.member).not.toHaveBeenCalled();});
it("ignores editable user metadata claiming to be admin",async()=>{mocks.member.mockResolvedValue({data:null,error:null});expect(await getStaffContext()).toEqual({error:'forbidden',status:403});});
it("denies inactive staff",async()=>{mocks.member.mockResolvedValue({data:{role:'admin',active:false},error:null});expect(await getStaffContext()).toEqual({error:'forbidden',status:403});});
it("denies a staff identity without completed MFA for business-data access",async()=>{mocks.assurance.mockResolvedValue({data:{currentLevel:'aal1'},error:null});expect(await getStaffContext()).toEqual({error:'mfa_required',status:403});});
it("allows active staff identity to access only the MFA setup step before aal2",async()=>{mocks.assurance.mockResolvedValue({data:{currentLevel:'aal1'},error:null});const result=await getStaffContext(false);expect('role'in result&&result.role).toBe('admin');expect(mocks.assurance).not.toHaveBeenCalled();});
it("returns verified user-scoped client for active aal2 staff",async()=>{const result=await getStaffContext();expect('user'in result&&result.user.id).toBe('fixture-staff');expect('role'in result&&result.role).toBe('admin');});
it("returns unavailable on an unreadable staff table",async()=>{mocks.member.mockResolvedValue({data:null,error:{message:'private database error'}});expect(await getStaffContext()).toEqual({error:'unavailable',status:503});});
