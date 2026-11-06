import { workflowActionSchema, type WorkflowAction, type WorkflowData } from "./model";
export function emptyWorkflow(): WorkflowData { return { submissions: [], reviews: [], activity: [], error: false }; }
// Browser-memory simulation only. This is not an authorization or storage backend.
export function applyDemoAction(data: WorkflowData, role: "staff" | "client" | "viewer", input: WorkflowAction): WorkflowData {
 const action = workflowActionSchema.parse(input);
 const now = new Date().toISOString();
 const id = () => crypto.randomUUID();
 const projectId = "demo-project";
 const activity = (event_type: "submission" | "review" | "update", detail: string) => [{ id: id(), project_id: projectId, event_type, detail, actor_role: role === "staff" ? "staff" as const : "client" as const, created_at: now }, ...data.activity];
 if (role === "viewer") throw new Error("Read-only demo role");
 if (action.action === "submit") {
  if (action.kind !== (role === "staff" ? "creative" : "brief")) throw new Error("Wrong demo role");
  const latest = Math.max(0, ...data.submissions.filter(s => s.kind === action.kind).map(s => s.version));
  if (latest >= 100) throw new Error("Demo revision limit");
  if (latest !== action.expectedVersion) throw new Error("Stale demo revision");
  return { ...data, submissions: [{ id: id(), project_id: projectId, kind: action.kind, version: latest + 1, title: action.title, body: action.body, reference_url: action.referenceUrl || null, author_role: role, created_at: now }, ...data.submissions], activity: activity("submission", `${action.kind}:${latest + 1}`) };
 }
 if (action.action === "review") {
  const item = data.submissions.find(s => s.id === action.submissionId);
  if (!item || item.kind !== (role === "staff" ? "brief" : "creative") || data.reviews.some(r => r.submission_id === item.id) || data.submissions.some(s => s.kind === item.kind && s.version > item.version)) throw new Error("Invalid demo review");
  return { ...data, reviews: [{ id: id(), submission_id: item.id, decision: action.decision, feedback: action.feedback, reviewer_role: role, created_at: now }, ...data.reviews], activity: activity("review", `${item.kind}:${item.version}:${action.decision}`) };
 }
 if (role !== "staff") throw new Error("Staff-only demo action");
 return { ...data, activity: activity("update", action.body) };
}
