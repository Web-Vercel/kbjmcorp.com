import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getAuthConfig } from "./config";

export async function consumeAuthLimit(phone: string, action: "sms" | "verify") {
  const config = getAuthConfig();
  if (!config) throw new Error("Auth unavailable");
  const digest = createHmac("sha256", config.rateSecret).update(phone).digest("hex");
  const keys = action === "sms" ? [`sms:minute:${digest}`, `sms:hour:${digest}`, "sms:global"] : [`verify:${digest}`, "verify:global"];
  const limits = action === "sms" ? [1, 5, 100] : [10, 500];
  const windows = action === "sms" ? [60, 3600, 600] : [600, 600];
  const db = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" }) },
  });
  const { data, error } = await db.rpc("consume_auth_limits", { p_keys: keys, p_limits: limits, p_windows: windows });
  if (error || !Number.isInteger(data) || data < 0) throw new Error("Rate limiter unavailable");
  return data as number; // 0 permits the operation; positive values are retry seconds.
}
