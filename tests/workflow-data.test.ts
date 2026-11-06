import { expect,it,vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkflow } from "@/lib/workflow/data";
it("does not show partial records or enable writes when a query fails",async()=>{
 const client={from:()=>({select:()=>({eq:()=>({order:()=>({limit:()=>Promise.resolve({data:null,error:{code:'unavailable'}})})})})})} as unknown as SupabaseClient;
 expect(await loadWorkflow(client,'project')).toEqual({submissions:[],reviews:[],activity:[],error:true});
});
it("batches review lookups to bound URL length while retaining version history",async()=>{
 const ids=Array.from({length:120},(_,i)=>({id:`fixture-${i}`}));const lookup=vi.fn().mockResolvedValue({data:[],error:null});
 const client={from:(table:string)=>({select:()=>table==='project_reviews'?{in:lookup}:{eq:()=>({order:()=>({limit:()=>Promise.resolve({data:table==='project_submissions'?ids:[],error:null})})})}})} as unknown as SupabaseClient;
 const result=await loadWorkflow(client,'project');expect(result.error).toBe(false);expect(result.submissions).toHaveLength(120);expect(lookup).toHaveBeenCalledTimes(3);expect(lookup.mock.calls.map(call=>call[1].length)).toEqual([50,50,20]);
});
it("discards submissions when review retrieval fails",async()=>{
 const client={from:(table:string)=>({select:()=>table==='project_reviews'?{in:()=>Promise.resolve({data:null,error:{code:'unavailable'}})}:{eq:()=>({order:()=>({limit:()=>Promise.resolve({data:table==='project_submissions'?[{id:'fixture'}]:[],error:null})})})}})} as unknown as SupabaseClient;
 expect((await loadWorkflow(client,'project')).error).toBe(true);
});
