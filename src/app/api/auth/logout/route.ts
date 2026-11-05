import { authResponse, readAuthBody } from "@/lib/auth/http";
import { authClient } from "@/lib/auth/server";
export async function POST(request: Request) {
  const input = await readAuthBody(request);
  if (input.error) return input.error;
  try {
    const client = await authClient(true);
    if (!client) return authResponse({ error: "unavailable" }, 503);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return authResponse({ error: "logout_failed" }, 502);
    return authResponse({ ok: true });
  } catch { return authResponse({ error: "unavailable" }, 503); }
}
