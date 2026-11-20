import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type ClientOrganization = { id: string; name: string };
export type ClientProject = { id: string; organization_id: string; name: string; target_market: string; status: string; updated_at: string; created_at: string };
export const clientProjectColumns = "id,organization_id,name,target_market,status,updated_at,created_at";
// Scope comes from authenticated server authorization, never a requested company ID.
export async function loadClientProjectScope(client: SupabaseClient) {
 const result = await client.rpc('get_client_project_scope');
 const {z} = await import('zod');
 const parsed = z.array(z.object({id:z.uuid(),name:z.string(),collaborate:z.boolean()})).safeParse(result.data);
 return result.error || !parsed.success ? {error:true,organizations:[]} : {error:false,organizations:parsed.data};
}
export async function loadClientWorkspace(client: SupabaseClient, _userId: string) {
 const scope = await loadClientProjectScope(client);
 if (scope.error) return {error:true as const,organizations:[],projects:[]};
 const ids=scope.organizations.map(o=>o.id);
 if (!ids.length) return {error:false as const,organizations:[],projects:[]};
 const projects=await client.from('projects').select(clientProjectColumns).in('organization_id',ids).order('updated_at',{ascending:false}).limit(100);
 if(projects.error) return {error:true as const,organizations:[],projects:[]};
 return {error:false as const,organizations:scope.organizations,projects:projects.data as ClientProject[]};
}
