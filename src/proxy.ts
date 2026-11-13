import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {demoCookie} from "@/lib/demo/policy";
import { getSessionConfig } from "@/lib/auth/config";

// Refresh SSR session cookies before Server Components render protected pages.
export async function proxy(request: NextRequest) {
  if(/^\/(zh|en)\/demo(?:\/|$)/.test(request.nextUrl.pathname)){
    const locale=request.nextUrl.pathname.startsWith('/en/')?'en':'zh';
    const response=NextResponse.redirect(new URL(`/${locale}/access/login`,request.url));
    response.headers.set('Cache-Control','private, no-store');return response;
  }
  if(request.nextUrl.pathname==='/api/demo/login')return NextResponse.json({error:'demo_retired'},{status:410,headers:{'Cache-Control':'no-store'}});

  if(request.nextUrl.pathname.startsWith("/api/")){
    if(request.cookies.has(demoCookie)&&!request.nextUrl.pathname.startsWith("/api/demo/"))return NextResponse.json({error:"demo_only"},{status:403,headers:{"Cache-Control":"private, no-store, max-age=0"}});
    return NextResponse.next({request});
  }
  if(request.cookies.has(demoCookie)&&!/^\/(zh|en)\/access\/login$/.test(request.nextUrl.pathname)){
    const locale=request.nextUrl.pathname.startsWith("/en/")?"en":"zh";
    const response=NextResponse.redirect(new URL(`/${locale}/access/login`,request.url));
    response.headers.set("Cache-Control","private, no-store, max-age=0");
    return response;
  }
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
export const config = { matcher: ["/zh/demo/:path*","/en/demo/:path*","/zh/access/:path*","/en/access/:path*","/api/:path*","/zh/account/:path*", "/en/account/:path*", "/zh/admin/:path*", "/en/admin/:path*", "/zh/operations/:path*", "/en/operations/:path*"] };
