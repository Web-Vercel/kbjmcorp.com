import { z } from "zod";
import { getStaffContext, staffError } from "@/lib/admin/guard";
import { authResponse, readAuthBody } from "@/lib/auth/http";
const schema = z.object({ organizationId: z.uuid(), userId: z.uuid(), action: z.enum(["grant_viewer", "grant_contributor", "revoke"]), confirm: z.literal("on") });
export async function POST(request: Request) {
 const input = await readAuthBody(request); if (input.error) return input.error;
 const parsed = schema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
 const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
 if (staff.role !== "admin") return authResponse({ error: "forbidden" }, 403);
 const p = parsed.data;
 const { error } = await staff.client.rpc("set_client_access", { p_organization_id: p.organizationId, p_user_id: p.userId, p_action: p.action });
 if (error) return authResponse({ error: error.code === "22023" ? "invalid_association" : "save_failed" }, error.code === "22023" ? 400 : 502);
 return authResponse({ ok: true });
}
