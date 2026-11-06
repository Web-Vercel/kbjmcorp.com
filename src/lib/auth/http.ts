import { NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/http/request-origin";

export function authResponse(body: object, status = 200, retryAfter?: number) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store, max-age=0",
    ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } });
}
export async function readAuthBody(request: Request, maxBytes = 8192): Promise<{ body: unknown; error?: never } | { error: NextResponse; body?: never }> {
  // Browser-only endpoints require an explicit same-origin request.
  if (!hasSameOrigin(request)) return { error: authResponse({ error: "forbidden" }, 403) };
  if (!request.headers.get("content-type")?.includes("application/json")) return { error: authResponse({ error: "json_required" }, 415) };
  const reader = request.body?.getReader();
  if (!reader) return { error: authResponse({ error: "invalid_input" }, 400) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); return { error: authResponse({ error: "too_large" }, 413) }; }
    chunks.push(value);
  }
  try { return { body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }; }
  catch { return { error: authResponse({ error: "invalid_json" }, 400) }; }
}
