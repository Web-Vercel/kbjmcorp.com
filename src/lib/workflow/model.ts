import { z } from "zod";
export const workflowActionSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("submit"), kind: z.enum(["brief", "creative"]), title: z.string().trim().min(2).max(160), body: z.string().trim().min(10).max(1500), referenceUrl: z.union([z.literal(""), z.url().max(1000).refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; })]).default(""), expectedVersion: z.coerce.number().int().min(0).max(100) }),
 z.object({ action: z.literal("review"), submissionId: z.uuid(), decision: z.enum(["approved", "changes_requested"]), feedback: z.string().trim().min(2).max(1000), confirm: z.literal("on") }),
 z.object({ action: z.literal("update"), body: z.string().trim().min(2).max(1000) }),
]);
export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type Submission = { id: string; project_id: string; kind: "brief" | "creative"; version: number; title: string; body: string; reference_url: string | null; author_role: "staff" | "client"; created_at: string };
export type Review = { id: string; submission_id: string; decision: "approved" | "changes_requested"; feedback: string; reviewer_role: "staff" | "client"; created_at: string };
export type Activity = { id: string; project_id: string; event_type: "status" | "submission" | "review" | "update"; detail: string; actor_role: "staff" | "client" | "system"; created_at: string };
export type WorkflowData = { submissions: Submission[]; reviews: Review[]; activity: Activity[]; error: boolean };
export function safeReference(value: string | null) {
 if (!value) return null;
 try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; } catch { return null; }
}
