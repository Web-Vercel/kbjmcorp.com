import { z } from "zod";
import { getStaffContext, staffError } from "@/lib/admin/guard";
import { companyConversionSchema } from "@/lib/admin/validation";
import { authResponse, readAuthBody } from "@/lib/auth/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const input = await readAuthBody(request); if (input.error) return input.error;
  const { id } = await params; const parsed = companyConversionSchema.safeParse(input.body);
  if (!z.uuid().safeParse(id).success || !parsed.success) return authResponse({ error: "invalid_input" }, 400);
  const staff = await getStaffContext(); if ("error" in staff) return staffError(staff);
  const { data, error } = await staff.client.rpc("convert_inquiry_to_client", { p_inquiry_id: id, p_company_name: parsed.data.companyName });
  if (error?.code === "22023") return authResponse({ error: "closed_inquiry" }, 409);
  if (error) return authResponse({ error: error.code === "P0002" ? "not_found" : "save_failed" }, error.code === "P0002" ? 404 : 502);
  return authResponse({ ok: true, organizationId: data });
}
