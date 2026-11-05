import { getStaffContext, staffError } from "@/lib/admin/guard";
import { projectSchema, projectStatusSchema } from "@/lib/admin/validation";
import { authResponse, readAuthBody } from "@/lib/auth/http";
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = projectSchema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
  const p = parsed.data;
  const { error } = await staff.client.from("projects").insert({ organization_id: p.organizationId, ad_account_id: p.adAccountId || null, name: p.name, target_market: p.market, budget_amount: p.budget || null, currency: p.currency, created_by: staff.user.id });
  return error ? authResponse({ error: "save_failed" }, 502) : authResponse({ ok: true }, 201);
}
export async function PATCH(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = projectStatusSchema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
  const { data, error } = await staff.client.from("projects").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) return authResponse({ error: "save_failed" }, 502);
  return data ? authResponse({ ok: true }) : authResponse({ error: "not_found" }, 404);
}
