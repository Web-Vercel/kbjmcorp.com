import {beforeEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadClientWorkspace} from '@/lib/client/data';
const rpc=vi.fn(),from=vi.fn(),scope=[{id:'b0000000-0000-4000-8000-000000000001',name:'Fixture',collaborate:true}];
const client={rpc,from} as unknown as SupabaseClient;
beforeEach(()=>vi.resetAllMocks());
it('does not query projects for empty or failed authorization',async()=>{
 for(const result of [{data:[],error:null},{data:scope,error:{code:'42501'}},{data:[{id:'invalid'}],error:null}]){rpc.mockResolvedValue(result);const data=await loadClientWorkspace(client,'user');expect(data.projects).toEqual([]);expect(from).not.toHaveBeenCalled();}
});
it('filters projects by authenticated scope without trusting a user supplied company',async()=>{
 rpc.mockResolvedValue({data:scope,error:null});const filter=vi.fn().mockReturnValue({order:()=>({limit:async()=>({data:[],error:null})})});from.mockReturnValue({select:()=>({in:filter})});
 const data=await loadClientWorkspace(client,'user');expect(data.error).toBe(false);expect(rpc).toHaveBeenCalledWith('get_client_project_scope');expect(filter).toHaveBeenCalledWith('organization_id',[scope[0].id]);
});
it('discards partial records on project query failure',async()=>{rpc.mockResolvedValue({data:scope,error:null});from.mockReturnValue({select:()=>({in:()=>({order:()=>({limit:async()=>({data:null,error:{code:'error'}})})})})});expect(await loadClientWorkspace(client,'user')).toEqual({error:true,organizations:[],projects:[]});});
