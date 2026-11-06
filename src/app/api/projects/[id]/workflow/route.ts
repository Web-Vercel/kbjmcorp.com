import { z } from "zod";
import { authClient } from "@/lib/auth/server";
import { authResponse, readAuthBody } from "@/lib/auth/http";
import { workflowActionSchema } from "@/lib/workflow/model";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
 const input = await readAuthBody(request); if (input.error) return input.error;
 const { id } = await params;
 const parsed = workflowActionSchema.safeParse(input.body);
 if (!z.uuid().safeParse(id).success || !parsed.success) return authResponse({ error: "invalid_input" }, 400);
 try {
  const client = await authClient(true); if (!client) return authResponse({ error: "unavailable" }, 503);
  const auth = await client.auth.getUser(); if (auth.error || !auth.data.user) return authResponse({ error: "unauthenticated" }, 401);
  // RPCs independently enforce company membership, collaborator role, staff MFA,
  // author/reviewer separation and latest-version checks using this user's JWT.
  const p = parsed.data;
  const result = p.action === "submit"
   ? await client.rpc("submit_project_content", { p_project_id: id, p_kind: p.kind, p_title: p.title, p_body: p.body, p_reference_url: p.referenceUrl, p_expected_version: p.expectedVersion })
   : p.action === "review"
    ? await client.rpc("review_project_content", { p_project_id: id, p_submission_id: p.submissionId, p_decision: p.decision, p_feedback: p.feedback })
    : await client.rpc("publish_project_update", { p_project_id: id, p_body: p.body });
  if (result.error) {
   const code = result.error.code;
   const status = code === "42501" ? 403 : code === "40001" || code === "23505" ? 409 : code === "22023" || code === "23514" ? 400 : code === "54000" ? 429 : code === "P0002" ? 404 : 502;
   return authResponse({ error: status === 409 ? "stale_revision" : status === 403 ? "forbidden" : status === 429 ? "record_limit" : "save_failed" }, status);
  }
  return authResponse({ ok: true }, p.action === "submit" ? 201 : 200);
 } catch { return authResponse({ error: "unavailable" }, 503); }
}
