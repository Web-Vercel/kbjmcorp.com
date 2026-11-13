import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getStaffContext } from "@/lib/admin/guard";
import { getPrivilegedConnection } from "@/lib/auth/privileged-config";

/** Emails are visible only to an MFA-verified administrator, for existing staff. */
export async function operatingStaffEmails(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const staff = await getStaffContext();
  if ("error" in staff || staff.role !== "admin") return result;
  const config = getPrivilegedConnection(); if (!config) return result;
  const directory = await staff.client.rpc("list_operating_staff");
  if (directory.error || !Array.isArray(directory.data)) return result;
  const ids = [...new Set(directory.data.map((s: { user_id: string }) => s.user_id))];
  const admin = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(5000) }) },
  });
  // Fetch only provisioned staff identities, never the entire Auth user directory.
  for (let offset = 0; offset < ids.length; offset += 5) {
    await Promise.all(ids.slice(offset, offset + 5).map(async id => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (!error && data.user?.email) result.set(id, data.user.email);
      } catch { /* The page retains a distinguishable fallback; never invent identity. */ }
    }));
  }
  return result;
}
