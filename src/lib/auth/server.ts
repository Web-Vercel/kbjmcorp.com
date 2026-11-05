import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthConfig } from "./config";

export async function authClient(writable = false) {
  const config = getAuthConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        // Server Component reads are refreshed by src/proxy.ts before rendering.
        try { items.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch (error) { if (writable) throw error; /* Proxy refreshes read-only Server Components. */ }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12000), cache: "no-store" }) },
  });
}
