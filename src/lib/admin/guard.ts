import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { authClient } from "@/lib/auth/server";
import { authResponse } from "@/lib/auth/http";

type StaffResult = { client: SupabaseClient; user: User; role: "admin" | "operator" } | { error: "unavailable" | "unauthenticated" | "forbidden" | "mfa_required"; status: number };
export async function getStaffContext(requireMfa = true): Promise<StaffResult> {
  const client = await authClient(true);
  if (!client) return { error: "unavailable" as const, status: 503 };
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { error: "unauthenticated" as const, status: 401 };
    const { data: staff, error: staffError } = await client.from("staff_members").select("role,active").eq("user_id", data.user.id).maybeSingle();
    if (staffError) return { error: "unavailable" as const, status: 503 };
    if (!staff?.active || !["admin", "operator"].includes(staff.role)) return { error: "forbidden" as const, status: 403 };
    if (requireMfa) {
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== "aal2") return { error: "mfa_required" as const, status: 403 };
    }
    return { client, user: data.user, role: staff.role as "admin" | "operator" };
  } catch { return { error: "unavailable" as const, status: 503 }; }
}
export function staffError(result: { error: string; status: number }) {
  return authResponse({ error: result.error }, result.status);
}
