import { beforeEach,expect,it,vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadClientWorkspace } from "@/lib/client/data";
const from=vi.fn();
const client={from} as unknown as SupabaseClient;
beforeEach(()=>vi.resetAllMocks());
it("never queries projects for an unassociated session",async()=>{from.mockReturnValue({select:()=>({eq:()=>Promise.resolve({data:[],error:null})})});expect(await loadClientWorkspace(client,'user')).toEqual({error:false,organizations:[],projects:[]});expect(from).toHaveBeenCalledTimes(1);});
it("uses explicit user and organization filters in addition to RLS",async()=>{
 const eq=vi.fn().mockResolvedValue({data:[{organization_id:'org-a'}],error:null});const orgIn=vi.fn().mockReturnValue({order:()=>Promise.resolve({data:[{id:'org-a',name:'Fixture'}],error:null})});const projectIn=vi.fn().mockReturnValue({order:()=>({limit:()=>Promise.resolve({data:[],error:null})})});
 from.mockImplementation((table:string)=>({select:()=>table==='memberships'?{eq}:table==='organizations'?{in:orgIn}:{in:projectIn}}));
 expect((await loadClientWorkspace(client,'verified-user')).error).toBe(false);expect(eq).toHaveBeenCalledWith('user_id','verified-user');expect(orgIn).toHaveBeenCalledWith('id',['org-a']);expect(projectIn).toHaveBeenCalledWith('organization_id',['org-a']);
});
it("discards all partial data if either business query fails",async()=>{
 from.mockImplementation((table:string)=>({select:()=>table==='memberships'?{eq:()=>Promise.resolve({data:[{organization_id:'org-a'}],error:null})}:{in:()=>({order:()=>table==='organizations'?Promise.resolve({data:[{id:'org-a',name:'Fixture'}],error:null}):{limit:()=>Promise.resolve({data:null,error:{code:'unavailable'}})}})}}));
 expect(await loadClientWorkspace(client,'user')).toEqual({error:true,organizations:[],projects:[]});
});
