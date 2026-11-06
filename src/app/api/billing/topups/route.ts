import { authResponse, readAuthBody } from "@/lib/auth/http";
import { authClient } from "@/lib/auth/server";
import { topupSchema, toMinor } from "@/lib/billing/model";
export async function POST(request: Request) {
 const input = await readAuthBody(request); if (input.error) return input.error;
 const parsed = topupSchema.safeParse(input.body); if (!parsed.success) return authResponse({ error: "invalid_input" }, 400);
 try {
  const client = await authClient(true); if (!client) return authResponse({ error: "unavailable" }, 503);
  const user = await client.auth.getUser(); if (user.error || !user.data.user) return authResponse({ error: "unauthenticated" }, 401);
  const { error } = await client.rpc("request_client_topup", { p_wallet_id: parsed.data.walletId, p_amount_minor: toMinor(parsed.data.amount), p_reference: parsed.data.reference });
  if (error) return authResponse({ error: error.code === "23505" ? "duplicate_reference" : error.code === "42501" ? "forbidden" : "save_failed" }, error.code === "23505" ? 409 : error.code === "42501" ? 403 : error.code === "54000" ? 429 : 502);
  return authResponse({ ok: true, status: "pending" }, 201);
 } catch { return authResponse({ error: "unavailable" }, 503); }
}
