import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionConfig } from "@/lib/auth/config";

// Refresh SSR session cookies before Server Components render protected pages.
export async function proxy(request: NextRequest) {
  const config = getSessionConfig();
  let response = NextResponse.next({ request });
  if (!config) return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000), cache: "no-store" }) },
  });
  try { await client.auth.getUser(); } catch { /* The protected page denies access on failure. */ }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = { matcher: ["/zh/account/:path*", "/en/account/:path*", "/zh/admin/:path*", "/en/admin/:path*"] };
