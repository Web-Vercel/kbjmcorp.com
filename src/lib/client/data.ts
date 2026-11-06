import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export type ClientOrganization = { id: string; name: string };
export type ClientProject = { id: string; organization_id: string; name: string; target_market: string; status: string; updated_at: string; created_at: string };
export const clientProjectColumns = "id,organization_id,name,target_market,status,updated_at,created_at";
// Explicit membership filtering also prevents a staff session's wider RLS from
// inadvertently turning the client page into a cross-company workspace.
export async function loadClientWorkspace(client: SupabaseClient, userId: string) {
 const memberships = await client.from("memberships").select("organization_id").eq("user_id", userId);
 if (memberships.error) return { error: true as const, organizations: [], projects: [] };
 const ids = memberships.data.map(row => row.organization_id);
 if (!ids.length) return { error: false as const, organizations: [], projects: [] };
 const [organizations, projects] = await Promise.all([
  client.from("organizations").select("id,name").in("id", ids).order("name"),
  client.from("projects").select(clientProjectColumns).in("organization_id", ids).order("updated_at", { ascending: false }).limit(100),
 ]);
 if (organizations.error || projects.error) return { error: true as const, organizations: [], projects: [] };
 return { error: false as const, organizations: organizations.data as ClientOrganization[], projects: projects.data as ClientProject[] };
}
