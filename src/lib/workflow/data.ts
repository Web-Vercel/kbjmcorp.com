import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowData } from "./model";
export async function loadWorkflow(client: SupabaseClient, projectId: string): Promise<WorkflowData> {
 const [submissions, activity] = await Promise.all([
  client.from("project_submissions").select("id,project_id,kind,version,title,body,reference_url,author_role,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(200),
  client.from("project_activity").select("id,project_id,event_type,detail,actor_role,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
 ]);
 if (submissions.error || activity.error) return { submissions: [], reviews: [], activity: [], error: true };
 const ids = submissions.data.map(row => row.id);
 const batches = [];
 for (let index = 0; index < ids.length; index += 50) batches.push(ids.slice(index, index + 50));
 // Keep PostgREST URLs bounded even after many historical revisions.
 const reviews = await Promise.all(batches.map(batch => client.from("project_reviews").select("id,submission_id,decision,feedback,reviewer_role,created_at").in("submission_id", batch)));
 if (reviews.some(result => result.error)) return { submissions: [], reviews: [], activity: [], error: true };
 return { submissions: submissions.data, reviews: reviews.flatMap(result => result.data || []), activity: activity.data, error: false } as WorkflowData;
}
