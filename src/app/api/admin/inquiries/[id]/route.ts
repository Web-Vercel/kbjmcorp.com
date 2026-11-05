import { z } from "zod";
import { getStaffContext, staffError } from "@/lib/admin/guard";
import { inquiryUpdateSchema } from "@/lib/admin/validation";
import { authResponse, readAuthBody } from "@/lib/auth/http";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const { id } = await params; const parsed = inquiryUpdateSchema.safeParse(input.body);
  if (!z.uuid().safeParse(id).success || !parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
  if (parsed.data.action === "note") {
    const { error } = await staff.client.from("inquiry_notes").insert({ inquiry_id: id, author_id: staff.user.id, body: parsed.data.body });
    return error ? authResponse({ error: "save_failed" }, 502) : authResponse({ ok: true }, 201);
  }
  const { data, error } = await staff.client.from("inquiries").update({ status: parsed.data.status }).eq("id", id).select("id").maybeSingle();
  if (error) return authResponse({ error: "save_failed" }, 502);
  return data ? authResponse({ ok: true }) : authResponse({ error: "not_found" }, 404);
}
