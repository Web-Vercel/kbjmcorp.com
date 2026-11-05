import { getStaffContext, staffError } from "@/lib/admin/guard";
import { accountSchema } from "@/lib/admin/validation";
import { authResponse, readAuthBody } from "@/lib/auth/http";
export async function POST(request: Request) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const parsed = accountSchema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
  if (staff.role !== "admin") return authResponse({ error: "forbidden" }, 403);
  const p = parsed.data;
  const { error } = await staff.client.from("ad_accounts").insert({ organization_id: p.organizationId, platform: "openai_ads", external_id: p.externalId, label: p.label });
  if (error) return authResponse({ error: error.code === "23505" ? "already_linked" : "save_failed" }, error.code === "23505" ? 409 : 502);
  return authResponse({ ok: true, connectionStatus: "unverified" }, 201);
}
